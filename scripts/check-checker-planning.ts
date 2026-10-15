import assert from "node:assert/strict";
import { simulateEncounter, resolvePartyProfile, type RosterGroup } from "../src/core/encounter-band/checkerV2";
import { focusShares } from "../src/core/encounter-band/tacticalAi";
import { checkPlannedEncounter } from "../src/core/encounter-band/checkerPlanning";
import { carryTacticalState, resourceCostForFight } from "../src/core/encounter-band/actTacticalState";
import { diagnoseEncounter } from "../src/core/encounter-band/encounterDiagnostics";
import type { TacticalMember } from "../src/core/encounter-band/tacticalSimulation";
const profile = (n: number) => ({ round1: n, round2: n, round3: n, round4Plus: n });
const body = (id: string, damage = 5, hp = 200, other: Partial<RosterGroup> = {}): RosterGroup =>
  ({ id, name: id, quantity: 1, baseHp: hp, dpr: profile(damage), ...other });
const member = (id: string, hp = 100, dpr = 10, extra: Partial<TacticalMember> = {}): TacticalMember =>
  ({ id, name: id, maxHp: hp, ac: 16, dpr: profile(dpr), ...extra });
const run = (roster: RosterGroup[], members = [member("A"), member("B"), member("C"), member("D")], rounds = 4) =>
  simulateEncounter({ roster, party: { size: members.length, sustain: members.reduce((s,p) => s+p.maxHp+(p.healing??0),0),
    dpr: profile(members.reduce((s,p) => s+(p.dpr.round1??0),0)), members }, settings: { tactical: true, maxRounds: rounds } });
let count = 0;
function test(name: string, f: () => void) { f(); console.log(`PASS ${name}`); count++; }
const snapshot = (r: ReturnType<typeof run>, i = 0) => r.rounds[i].tactical!;

test("reachable targeting excludes downed/backline targets and normalizes ties", () => {
  assert.deepEqual(focusShares([0,1,2].map(i => ({hp:i===0?0:30,maxHp:30,ac:15,reach:1}))), [0,.5,.5]);
  assert.deepEqual(focusShares([{hp:30,maxHp:30,ac:15,reach:1},{hp:1,maxHp:30,ac:10,reach:0}]), [1,0]);
});
test("target priority reranks each round without moving previously dealt damage", () => {
  const r=run([body("nova",50,300,{dpr:{round1:50,round2:0,round3:0,round4Plus:0}}),body("steady",30,300)]);
  assert(snapshot(r).bodies[0].damageIntoGroup>0); assert.equal(snapshot(r).bodies[1].damageIntoGroup,0);
  assert.equal(snapshot(r,1).bodies[0].damageIntoGroup,snapshot(r).bodies[0].damageIntoGroup);
  assert(snapshot(r,1).bodies[1].damageIntoGroup>0);
});
test("forced passive and reactive targeting precede threat", () => {
  const r=run([body("danger",100),body("guard",0,200,{killOrderFirst:true})]);
  assert.equal(snapshot(r).bodies[0].damageIntoGroup,0); assert(snapshot(r).bodies[1].damageIntoGroup>0);
  const q=run([body("danger",100),body("guard",0,200,{redirectsPartyActionsPerRound:1})]);
  assert(snapshot(q).bodies.every(b=>b.damageIntoGroup>0));
});
test("delayed arrivals do not absorb earlier unused damage", () => {
  const r=run([body("first",0,5),body("late",0,60,{arrivesRound:3})]);
  assert.equal(snapshot(r,1).bodies[1].damageIntoGroup,0); assert.equal(r.completionRound,4);
});
test("melee targets frontline; individual defenses affect expected damage", () => {
  const members=[member("front",100,0,{frontline:true,ac:20}),member("back",100,0,{ac:10})];
  const r=run([body("melee",20,200,{tactical:{meleeOnly:true,areaShare:{},vsPcDpr:[profile(10),profile(30)]}})],members,1);
  assert.equal(snapshot(r).party[1].damageReceived,0); assert.equal(r.rounds[0].monsterDamage,10);
});
test("downed characters stop contributing their own damage", () => {
  const r=run([body("enemy",100,1000)],[member("fragile",1,50,{ac:8}),member("tank",1000,1,{ac:22})],2);
  assert.equal(snapshot(r).party[0].hp,0); assert.equal(r.rounds[1].partyPotential,1);
});
test("healing can rescue, spends a finite pool, and displaces offense", () => {
  const r=run([body("enemy",0,1000)],[member("down",30,20,{hp:0}),member("healer",100,10,{healing:10,healingPerUse:10})],2);
  assert.equal(snapshot(r).party[0].hp,10); assert.equal(snapshot(r).party[1].healingLeft,0);
  assert.equal(r.rounds[0].partyDamage,0); assert(r.rounds[1].partyDamage>0);
});
test("temporary HP refreshes by maximum rather than accumulating", () => {
  const r=run([body("enemy",0,1000)],[member("bond",100,1,{hp:20,bond:{kind:"temp",amount:10}})],3);
  assert.deepEqual(r.rounds.map(x=>x.tactical!.party[0].tempHp),[10,10,10]);
});
test("signed interaction costs reduce pressure and diagnostics reconcile", () => {
  const roster=[body("enemy",20),body("cost",-5,0,{bodiless:true})]; const r=run(roster);
  assert.equal(r.rounds[0].monsterDamage,15);
  assert(diagnoseEncounter(r,roster,4,400).reconciles);
});
test("concentration-dependent pressure ends with its holder", () => {
  const r=run([body("holder",0,5),body("zone",10,0,{bodiless:true,endsWithGroupId:"holder",
    concentration:{holderGroupId:"holder",conSave:0,activeTurns:2,dependent:profile(10),fixed:profile(0)}})]);
  assert.equal(r.completionRound,1);
  const zone=snapshot(r).bodies.find(b=>b.creature==="zone")!;
  assert.equal(zone.aliveAtEnd,0);
});
test("a Guardian draws the configured share without overriding reach", () => {
  const shares=focusShares([{hp:100,maxHp:100,ac:20,reach:1,guardian:true},{hp:5,maxHp:100,ac:10,reach:1}]);
  assert(Math.abs(shares[0]-.85)<1e-9);assert(Math.abs(shares.reduce((a,b)=>a+b,0)-1)<1e-9);
});
test("short rests cannot reuse spent Hit Dice; long rest refreshes the pool", () => {
  const m=[member("rest",100,0,{hp:20})]; const r=run([body("enemy",0,1000)],m,1);
  const dice:Record<string,number>={}; const cap={rest:.5};
  assert.equal(carryTacticalState(m,r,"Short",dice,cap).rest.hpFraction,.7);
  assert.equal(dice.rest,0);
  assert.equal(carryTacticalState(m,r,"Short",dice,cap).rest.hpFraction,.2);
  assert.equal(carryTacticalState(m,r,"Long",dice,cap).rest.hpFraction,1);
  assert.equal(dice.rest,.5);
});
test("resource spending uses the schedule independently of damage received", () => {
  const s=[{actor:"A",action:"spell",trigger:"spell-action",round:1,usesPerFight:1,valuePerUse:10}] as const;
  assert(resourceCostForFight(s,1,0)>0); assert.equal(resourceCostForFight([],5,0),0);
  assert.equal(resourceCostForFight(s,1,1),0);
});
const template={ templateId:"test-enemy",name:"Test Enemy",stats:{ac:15,maxHp:120,attacksPerTurn:1},
  abilities:[],actions:[{name:"Claw",activationType:"action",roll:"1d20+5",damage:"1d8+3",range:"Melee 5 ft.",text:"Melee attack, reach 5 ft."}] } as never;
const actor={ id:"test-pc",name:"Test PC",kind:"player",level:7,className:"Fighter",attacksPerAction:2,
  stats:{ac:18,hp:{max:60,current:60},speed:"30 ft."},
  abilityScores:{str:{score:18},dex:{score:12},con:{score:16},int:{score:10},wis:{score:12},cha:{score:10}},
  tabs:{main:[{id:"sword",label:"Longsword",actionKind:"attack",economyCost:["main"],logMode:"default",
    metadata:{attack:"1d20+@STR+@PROF",damage:"1d8+@STR",damageType:"Slashing",range:"5 ft."}}],resources:[],equipment:[]} } as never;
const base={entries:[{template,quantity:1}],library:[template],actors:[actor],size:1,mode:"wotcStandard" as const};
test("saved actor stays unchanged while selected-level damage, sustain and defenses project", () => {
  const before=JSON.stringify(actor); const now=checkPlannedEncounter({...base,level:7}); const future=checkPlannedEncounter({...base,level:10});
  assert(now.plan); assert(future.plan); assert(future.plan.projected);
  const from=resolvePartyProfile({level:7,size:4,equipmentMode:base.mode});const to=resolvePartyProfile({level:10,size:4,equipmentMode:base.mode});
  assert(Math.abs(future.dpr.round1/now.dpr.round1-to.dpr.round1/from.dpr.round1)<1e-8);
  assert(future.fullSustain>now.fullSustain); assert.equal(JSON.stringify(actor),before);
  assert(future.result?.rounds[0].tactical); assert(future.built.roster[0].tactical?.vsPcDpr?.length===1);
});
test("fresh checks are deterministic; selected member injuries carry into the next fight", () => {
  const a=checkPlannedEncounter({...base,level:7});const b=checkPlannedEncounter({...base,level:7});assert.deepEqual(a.result,b.result);
  const hurt=checkPlannedEncounter({...base,level:7,memberState:{"test-pc":{hpFraction:.25,healingFraction:0,tempHp:0}}});
  assert.equal(hurt.members[0].hp,hurt.members[0].maxHp*.25);
});
test("empty and mismatched parties fail explicitly", () => {
  assert.throws(()=>checkPlannedEncounter({...base,level:7,size:2}),/Choose exactly/);
  assert.throws(()=>checkPlannedEncounter({...base,level:7,entries:[]}),/No readable/);
});
console.log(`${count} integration checks passed`);
