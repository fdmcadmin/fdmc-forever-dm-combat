import { useCallback, useEffect, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";

export const FDM_DICE_REQUEST_CHANNEL = "forever-dm-combat.roll.request.v1";
export const FDM_DICE_RESULT_CHANNEL = "forever-dm-combat.roll.result.v1";
export const FDM_DICE_PLUS_SOURCE = "forever-dm-combat";
export const DICE_PLUS_READY_CHANNEL = "dice-plus/isReady";
export const DICE_PLUS_ROLL_REQUEST_CHANNEL = "dice-plus/roll-request";
export const DICE_PLUS_RESULT_CHANNEL = `${FDM_DICE_PLUS_SOURCE}/roll-result`;
export const DICE_PLUS_ERROR_CHANNEL = `${FDM_DICE_PLUS_SOURCE}/roll-error`;

export type DiceBridgeStatus = "outside-owlbear" | "starting" | "ready" | "error";

export type DiceBridgeRollRequest = {
  protocol: "forever-dm-combat.roll.request.v1";
  requestId: string;
  source: "Forever DM Combat";
  actorId: string;
  actorName: string;
  actionId: string;
  actionName: string;
  formula: string;
  outcomeMode: "attack-roll" | "ability-check" | "dc-check" | "triggered";
  critThreshold?: number;
  sentAt: string;
};

export type DiceBridgeRollResult = {
  protocol?: string;
  requestId?: string;
  actorId?: string;
  actorName?: string;
  actionId?: string;
  actionName?: string;
  formula?: string;
  naturalRoll?: number;
  total?: number;
  result?: string;
  text?: string;
  source?: string;
  receivedAt?: string;
};

export type DiceBridgeEvent = {
  kind:
    | "request-sent"
    | "request-seen"
    | "result-sent"
    | "result-received"
    | "dice-plus-ready"
    | "dice-plus-request-sent"
    | "error";
  message: string;
  request?: DiceBridgeRollRequest;
  result?: DiceBridgeRollResult;
};

type DicePlusDiceResult = {
  diceType?: string;
  value?: number;
  kept?: boolean;
};

type DicePlusGroup = {
  diceType?: string;
  dice?: DicePlusDiceResult[];
  total?: number;
  isNegative?: boolean;
};

type DicePlusRollResultEnvelope = {
  rollId?: string;
  playerId?: string;
  playerName?: string;
  rollTarget?: string;
  timestamp?: number;
  result?: {
    rollId?: string;
    diceNotation?: string;
    totalValue?: number;
    rollSummary?: string;
    groups?: DicePlusGroup[];
  };
};

type DicePlusRollError = {
  rollId?: string;
  error?: string;
  notation?: string;
};

function hasOwlbearWindow() {
  return typeof window !== "undefined" && OBR.isAvailable;
}

function getString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeRollResult(data: unknown): DiceBridgeRollResult | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const incoming = data as Record<string, unknown>;
  const requestId = getString(incoming.requestId);
  const naturalRoll = getNumber(incoming.naturalRoll);
  const total = getNumber(incoming.total);
  const result = getString(incoming.result);
  const text = getString(incoming.text);

  if (!requestId && typeof total !== "number" && typeof naturalRoll !== "number" && !result && !text) {
    return null;
  }

  return {
    protocol: getString(incoming.protocol),
    requestId,
    actorId: getString(incoming.actorId),
    actorName: getString(incoming.actorName),
    actionId: getString(incoming.actionId),
    actionName: getString(incoming.actionName),
    formula: getString(incoming.formula),
    naturalRoll,
    total,
    result,
    text,
    source: getString(incoming.source) ?? "External dice bridge",
    receivedAt: new Date().toISOString(),
  };
}

function findDicePlusNaturalRoll(groups?: DicePlusGroup[]) {
  if (!Array.isArray(groups)) {
    return undefined;
  }

  const d20Values: number[] = [];

  for (const group of groups) {
    if (group.diceType?.toLowerCase() !== "d20") {
      continue;
    }

    const dice = Array.isArray(group.dice) ? group.dice : [];
    const keptDice = dice.filter((die) => die.kept !== false && typeof die.value === "number");
    const diceToRead = keptDice.length > 0 ? keptDice : dice.filter((die) => typeof die.value === "number");

    for (const die of diceToRead) {
      if (typeof die.value === "number") {
        d20Values.push(die.value);
      }
    }
  }

  if (d20Values.length === 0) {
    return undefined;
  }

  return Math.max(...d20Values);
}

function normalizeDicePlusRollResult(data: unknown): DiceBridgeRollResult | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const envelope = data as DicePlusRollResultEnvelope;
  const rollId = envelope.rollId ?? envelope.result?.rollId;
  const total = envelope.result?.totalValue;

  if (!rollId || typeof total !== "number") {
    return null;
  }

  const naturalRoll = findDicePlusNaturalRoll(envelope.result?.groups);
  const resultText = typeof naturalRoll === "number" ? `nat ${naturalRoll} / total ${total}` : `total ${total}`;

  return {
    protocol: DICE_PLUS_RESULT_CHANNEL,
    requestId: rollId,
    formula: envelope.result?.diceNotation,
    naturalRoll,
    total,
    result: resultText,
    text: envelope.result?.rollSummary,
    source: "Dice+",
    receivedAt: new Date().toISOString(),
  };
}

function normalizeDicePlusError(data: unknown): DicePlusRollError | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const incoming = data as Record<string, unknown>;
  const rollId = getString(incoming.rollId);
  const error = getString(incoming.error);
  const notation = getString(incoming.notation);

  if (!rollId && !error && !notation) {
    return null;
  }

  return { rollId, error, notation };
}

export function formatBridgeRollResult(result: DiceBridgeRollResult) {
  if (result.result?.trim()) {
    return result.result.trim();
  }

  if (result.text?.trim()) {
    return result.text.trim();
  }

  if (typeof result.naturalRoll === "number" && typeof result.total === "number") {
    return `nat ${result.naturalRoll} / total ${result.total}`;
  }

  if (typeof result.total === "number") {
    return `total ${result.total}`;
  }

  if (typeof result.naturalRoll === "number") {
    return `nat ${result.naturalRoll}`;
  }

  return "";
}

function createRequestId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function getOwlbearPlayerInfo() {
  const playerApi = OBR.player as unknown as {
    getId?: () => Promise<string>;
    getName?: () => Promise<string>;
  };

  const playerId = playerApi.getId ? await playerApi.getId() : "unknown-player";
  const playerName = playerApi.getName ? await playerApi.getName() : "Owlbear Player";

  return { playerId, playerName };
}

export function useOwlbearDiceBridge(onResult?: (result: DiceBridgeRollResult) => void) {
  const [status, setStatus] = useState<DiceBridgeStatus>(() => (hasOwlbearWindow() ? "starting" : "outside-owlbear"));
  const [lastEvent, setLastEvent] = useState<DiceBridgeEvent | null>(null);

  useEffect(() => {
    if (!hasOwlbearWindow()) {
      setStatus("outside-owlbear");
      return;
    }

    let unsubRequest: (() => void) | undefined;
    let unsubResult: (() => void) | undefined;
    let unsubDicePlusResult: (() => void) | undefined;
    let unsubDicePlusError: (() => void) | undefined;
    let disposed = false;

    function connectBridge() {
      if (disposed) {
        return;
      }

      setStatus("ready");
      unsubRequest = OBR.broadcast.onMessage(FDM_DICE_REQUEST_CHANNEL, (event) => {
        const request = event.data as DiceBridgeRollRequest;
        setLastEvent({
          kind: "request-seen",
          message: `Dice request seen for ${request?.actionName ?? "unknown action"}.`,
          request,
        });
      });

      unsubResult = OBR.broadcast.onMessage(FDM_DICE_RESULT_CHANNEL, (event) => {
        const result = normalizeRollResult(event.data);

        if (!result) {
          return;
        }

        setLastEvent({
          kind: "result-received",
          message: `Dice result received${result.actionName ? ` for ${result.actionName}` : ""}.`,
          result,
        });
        onResult?.(result);
      });

      unsubDicePlusResult = OBR.broadcast.onMessage(DICE_PLUS_RESULT_CHANNEL, (event) => {
        const result = normalizeDicePlusRollResult(event.data);

        if (!result) {
          return;
        }

        setLastEvent({
          kind: "result-received",
          message: `Dice+ result received${result.text ? `: ${result.text}` : ""}.`,
          result,
        });
        onResult?.(result);
      });

      unsubDicePlusError = OBR.broadcast.onMessage(DICE_PLUS_ERROR_CHANNEL, (event) => {
        const error = normalizeDicePlusError(event.data);

        if (!error) {
          return;
        }

        setLastEvent({
          kind: "error",
          message: `Dice+ roll failed${error.error ? `: ${error.error}` : ""}${error.notation ? ` (${error.notation})` : ""}.`,
        });
      });
    }

    try {
      if (OBR.isReady) {
        connectBridge();
      } else {
        OBR.onReady(connectBridge);
      }
    } catch (error) {
      setStatus("error");
      setLastEvent({
        kind: "error",
        message: error instanceof Error ? error.message : "Owlbear dice bridge failed to start.",
      });
    }

    return () => {
      disposed = true;
      unsubRequest?.();
      unsubResult?.();
      unsubDicePlusResult?.();
      unsubDicePlusError?.();
    };
  }, [onResult]);

  const checkDicePlusReady = useCallback(async () => {
    if (!hasOwlbearWindow() || status !== "ready") {
      return false;
    }

    const requestId = createRequestId("fdm-dice-plus-ready");

    return new Promise<boolean>((resolve) => {
      let settled = false;
      let unsubscribe: (() => void) | undefined;

      function finish(isReady: boolean) {
        if (settled) {
          return;
        }

        settled = true;
        unsubscribe?.();
        resolve(isReady);
      }

      try {
        unsubscribe = OBR.broadcast.onMessage(DICE_PLUS_READY_CHANNEL, (event) => {
          const incoming = event.data as Record<string, unknown>;

          if (incoming.requestId === requestId && incoming.ready === true) {
            setLastEvent({
              kind: "dice-plus-ready",
              message: "Dice+ is ready.",
            });
            finish(true);
          }
        });

        void OBR.broadcast.sendMessage(DICE_PLUS_READY_CHANNEL, { requestId, timestamp: Date.now() }, { destination: "ALL" });
      } catch (error) {
        setLastEvent({
          kind: "error",
          message: error instanceof Error ? error.message : "Dice+ ready check failed.",
        });
        finish(false);
      }

      window.setTimeout(() => finish(false), 1200);
    });
  }, [status]);

  const sendRollRequest = useCallback(async (request: DiceBridgeRollRequest) => {
    if (!hasOwlbearWindow() || status !== "ready") {
      setLastEvent({
        kind: "error",
        message: "Owlbear bridge is not ready. Use manual roll entry or test inside an Owlbear room.",
        request,
      });
      return false;
    }

    try {
      await OBR.broadcast.sendMessage(FDM_DICE_REQUEST_CHANNEL, request, { destination: "ALL" });
      setLastEvent({
        kind: "request-sent",
        message: `Generic dice request sent for ${request.actionName}.`,
        request,
      });
      return true;
    } catch (error) {
      setStatus("error");
      setLastEvent({
        kind: "error",
        message: error instanceof Error ? error.message : "Dice request failed to send.",
        request,
      });
      return false;
    }
  }, [status]);

  const sendDicePlusRollRequest = useCallback(async (request: DiceBridgeRollRequest) => {
    if (!hasOwlbearWindow() || status !== "ready") {
      setLastEvent({
        kind: "error",
        message: "Owlbear bridge is not ready. Use manual roll entry or test inside an Owlbear room.",
        request,
      });
      return false;
    }

    const dicePlusReady = await checkDicePlusReady();

    if (!dicePlusReady) {
      setLastEvent({
        kind: "error",
        message: "Dice+ did not respond. Confirm Dice+ is installed and enabled in this Owlbear room, or use manual roll entry.",
        request,
      });
      return false;
    }

    try {
      const { playerId, playerName } = await getOwlbearPlayerInfo();

      await OBR.broadcast.sendMessage(
        DICE_PLUS_ROLL_REQUEST_CHANNEL,
        {
          rollId: request.requestId,
          playerId,
          playerName,
          rollTarget: "everyone",
          diceNotation: request.formula,
          showResults: true,
          timestamp: Date.now(),
          source: FDM_DICE_PLUS_SOURCE,
        },
        { destination: "ALL" }
      );

      setLastEvent({
        kind: "dice-plus-request-sent",
        message: `Dice+ roll request sent for ${request.actionName}.`,
        request,
      });
      return true;
    } catch (error) {
      setStatus("error");
      setLastEvent({
        kind: "error",
        message: error instanceof Error ? error.message : "Dice+ roll request failed to send.",
        request,
      });
      return false;
    }
  }, [checkDicePlusReady, status]);

  const sendMockRollResult = useCallback(async (result: DiceBridgeRollResult) => {
    if (!hasOwlbearWindow() || status !== "ready") {
      setLastEvent({
        kind: "error",
        message: "Owlbear bridge is not ready. Mock result broadcast is only active inside Owlbear.",
        result,
      });
      return false;
    }

    const payload: DiceBridgeRollResult = {
      protocol: FDM_DICE_RESULT_CHANNEL,
      source: result.source ?? "Forever DM Combat mock catcher",
      receivedAt: new Date().toISOString(),
      ...result,
    };

    try {
      await OBR.broadcast.sendMessage(FDM_DICE_RESULT_CHANNEL, payload, { destination: "ALL" });
      setLastEvent({
        kind: "result-sent",
        message: `Mock dice result sent${payload.actionName ? ` for ${payload.actionName}` : ""}.`,
        result: payload,
      });
      return true;
    } catch (error) {
      setStatus("error");
      setLastEvent({
        kind: "error",
        message: error instanceof Error ? error.message : "Mock dice result failed to send.",
        result: payload,
      });
      return false;
    }
  }, [status]);

  return {
    status,
    lastEvent,
    requestChannel: FDM_DICE_REQUEST_CHANNEL,
    resultChannel: FDM_DICE_RESULT_CHANNEL,
    dicePlusReadyChannel: DICE_PLUS_READY_CHANNEL,
    dicePlusRollRequestChannel: DICE_PLUS_ROLL_REQUEST_CHANNEL,
    dicePlusResultChannel: DICE_PLUS_RESULT_CHANNEL,
    dicePlusErrorChannel: DICE_PLUS_ERROR_CHANNEL,
    sendRollRequest,
    sendDicePlusRollRequest,
    sendMockRollResult,
  };
}
