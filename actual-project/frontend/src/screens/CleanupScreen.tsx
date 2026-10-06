import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getBeach } from "../api";
import { useApp } from "../AppContext";
import {
  CoastalPage,
  DataUnavailable,
  SummaryCard,
  WhiteCard,
} from "../components/CoastalUI";
import { Alert, InfoChip } from "../components/ds";
import { Camera, Check, Info, Pin } from "../components/Icon";
import {
  DraftChoiceDialog,
  GhostButton,
  PrimaryButton,
  Skeleton,
} from "../components/ui";
import { confirmedCleanupBands } from "../cleanupFlow";
import {
  cleanupDraftScope,
  cleanupTargetVersion,
  clearCleanupDraft,
  readCleanupDraft,
  writeCleanupDraft,
} from "../cleanupDraft";
import {
  analyseCleanupPhoto,
  CLEANUP_BAND_UNITS,
  QUANTITY_BANDS,
} from "../iteration2";
import {
  fetchCleanupEvent,
  fetchCleanupTarget,
  submitCleanup,
} from "../iteration2Api";
import { hasDraftProgress, resumePath } from "../flowRules";
import { useAsyncData } from "../useAsyncData";
import { C, QUANTITY_DESC } from "../theme";
import type { LitterCategory, QuantityBand } from "../types";
import "../styles/community-alignment.css";

export default function CleanupScreen() {
  const { beachId = "" } = useParams();
  const [params] = useSearchParams();
  const eventId = params.get("event");
  const nav = useNavigate();
  const {
    user,
    draft,
    resetDraft,
    patchDraft,
    setLastSavedReport,
    bumpReports,
  } = useApp();
  const {
    data: target,
    loading,
    error: targetError,
    refresh,
  } = useAsyncData(() => fetchCleanupTarget(beachId), [beachId], null);
  const { data: beach } = useAsyncData(
    () => getBeach(beachId),
    [beachId],
    null,
  );
  const { data: event } = useAsyncData(
    () => (eventId ? fetchCleanupEvent(eventId) : Promise.resolve(null)),
    [eventId],
    null,
  );
  const [category, setCategory] = useState<LitterCategory | null>(null);
  const [after, setAfter] = useState<QuantityBand | null>(null);
  const [step, setStep] = useState<"linked" | "amount" | "ai">("linked");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftChoice, setDraftChoice] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<QuantityBand | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const key = useRef<string>(crypto.randomUUID());
  const operation = useRef(0);
  const busyRef = useRef(false);
  const scope = cleanupDraftScope(user?.participantId ?? "guest", beachId, eventId);
  const context = target ? scope + cleanupTargetVersion(target) : null;
  const [restoredContext, setRestoredContext] = useState<string | null>(null);
  const categories = (Object.keys(target?.remainingBands ?? {}) as LitterCategory[])
    .filter(c => CLEANUP_BAND_UNITS[target!.remainingBands[c]!] > 1);
  const selected =
    category && categories.includes(category)
      ? category
      : (categories.find(
          (c) => CLEANUP_BAND_UNITS[target!.remainingBands[c]!] > 1,
        ) ?? categories[0]);
  const before = selected ? target?.remainingBands[selected] : undefined;
  useEffect(() => {
    operation.current += 1;
    busyRef.current = false;
    setBusy(false);
    return () => { operation.current += 1; };
  }, [scope, context]);
  useEffect(() => {
    if (loading || targetError) return;
    if (!target) {
      clearCleanupDraft(scope);
      setRestoredContext(null);
      return;
    }
    const saved = readCleanupDraft(scope, target);
    setCategory(saved.category);
    setAfter(saved.after);
    setStep(saved.step);
    setPhoto(saved.photo);
    setSuggestion(saved.suggestion);
    key.current = saved.idempotencyKey;
    setError(null);
    setRestoredContext(context);
  }, [scope, context, loading, targetError]);
  useEffect(() => {
    if (!target || restoredContext !== context || loading) return;
    writeCleanupDraft(scope, target, {
      category, after, step, photo, suggestion, idempotencyKey: key.current,
    });
  }, [scope, context, restoredContext, loading, category, after, step, photo, suggestion]);
  useEffect(() => {
    if (!photo) {
      setPhotoUrl(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  const back = eventId ? "/events/" + eventId : "/beach/" + beachId;
  const startReport = () => {
    resetDraft();
    setLastSavedReport(null);
    patchDraft({
      beachId,
      beachName: beach?.name ?? target?.beachName ?? null,
      linkedEventId: event?.joined ? event.id : null,
    });
    nav("/report/photo");
  };
  async function analyse(file: File) {
    if (!target || !selected || busyRef.current) return;
    const request = ++operation.current;
    busyRef.current = true;
    setPhoto(file);
    setStep("ai");
    setBusy(true);
    setError(null);
    setSuggestion(null);
    try {
      const result = await analyseCleanupPhoto(file, target);
      if (request !== operation.current) return;
      setSuggestion(result[selected] ?? null);
      if (!result[selected])
        setError(
          "No reliable suggestion for this litter type. Choose the amount yourself.",
        );
    } catch (reason) {
      if (request !== operation.current) return;
      setError(
        reason instanceof Error
          ? reason.message
          : "The photo could not be checked. You can choose the amount yourself.",
      );
    } finally {
      if (request === operation.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }
  async function save() {
    if (busyRef.current) return;
    if (!after) {
      setStep("amount");
      return;
    }
    if (!target || !selected || !user) return;
    const request = ++operation.current;
    const submissionKey = key.current;
    setError(null);
    try {
      const afterBands = confirmedCleanupBands(
        target.remainingBands,
        selected,
        after,
      );
      setBusy(true);
      busyRef.current = true;
      const cleanup = await submitCleanup({
        participantId: user.participantId,
        targetReportId: target.reportId,
        eventId,
        afterBands,
        handling: "Not recorded",
        idempotencyKey: submissionKey,
      });
      clearCleanupDraft(scope, submissionKey);
      bumpReports();
      if (request !== operation.current) return;
      nav("/cleanup/result/" + cleanup.id, { replace: true });
    } catch (reason) {
      if (request !== operation.current) return;
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not save cleanup. Please try again.",
      );
    } finally {
      if (request === operation.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }
  if (loading)
    return (
      <CoastalPage title="Log Your Cleanup" back={back} tabs={false}>
        <Skeleton h={260} r={22} />
      </CoastalPage>
    );
  if (targetError)
    return (
      <CoastalPage title="Log Your Cleanup" back={back} tabs={false}>
        <DataUnavailable
          title="Could not load the linked report"
          retry={() => void refresh()}
        >
          {targetError}
        </DataUnavailable>
      </CoastalPage>
    );
  if (!target)
    return (
      <CoastalPage
        title="Start with a Litter Report"
        eyebrow="Log cleanup"
        subtitle="Record what you found, then log what remains after cleaning."
        back={back}
        tabs={false}
        className="cleanup-alignment"
      >
        {draftChoice && (
          <DraftChoiceDialog
            onCancel={() => setDraftChoice(false)}
            onResume={() => nav(resumePath(draft))}
            onStartNew={() => {
              setDraftChoice(false);
              startReport();
            }}
          />
        )}
        <WhiteCard>
          <div className="cleanup-beach-row">
            <span className="cleanup-beach-icon"><Pin color={C.lime} size={24} /></span>
            <div><strong>{beach?.name ?? beachId}</strong><small>Cleanup at this beach</small></div>
          </div>
        </WhiteCard>
        <WhiteCard>
          <p className="eyebrow">Two steps</p>
          <div className="cleanup-start-steps">
            <div><span>1</span><div><strong>Report the litter</strong><small>Photo and amounts, before you clean</small></div></div>
            <div><span>2</span><div><strong>Log what remains</strong><small>After cleaning, compare with your report</small></div></div>
          </div>
        </WhiteCard>
        <div className="cleanup-information"><Info size={17} /><span>Before and after stay linked to this beach.</span></div>
        <PrimaryButton
          onClick={() =>
            hasDraftProgress(draft) ? setDraftChoice(true) : startReport()
          }
          trailingArrow
        >
          <Camera color={C.lime} size={18} /> Report Litter Here
        </PrimaryButton>
        <GhostButton onClick={() => nav(back, { replace: true })}>
          {eventId ? "Back to Event" : "Back to Beach"}
        </GhostButton>
      </CoastalPage>
    );
  const photoInput = (
    <input
      ref={input}
      type="file"
      accept="image/*"
      capture="environment"
      hidden
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) void analyse(file);
        e.target.value = "";
      }}
    />
  );
  if (step === "amount")
    return (
      <CoastalPage
        title="Litter Left After Cleanup"
        eyebrow={selected}
        subtitle="Check with AI first, or choose the amount yourself."
        back={undefined}
        tabs={false}
      >
        <button disabled={busy} onClick={() => setStep("linked")} style={{ color: C.navy }}>
          ← Back to linked report
        </button>
        {photoInput}
        <p className="subtle">
          Reported as <span className="band-pill">{before}</span>
        </p>
        <SummaryCard eyebrow="AI check">
          <Camera color={C.lime} size={26} />
          <h2 style={{ color: "white", marginTop: 12 }}>
            Take an After-Cleanup Photo
          </h2>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: "#ffffffbf" }}>
            AI suggests how much is left. You confirm the amount.
          </p>
          <button
            className="lime-button"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            Take Photo
          </button>
          <p className="coastal-footnote" style={{ color: "#ffffffa6" }}>
            Used for analysis, then deleted. Not saved to your cleanup record.
          </p>
        </SummaryCard>
        <p className="eyebrow">Or choose yourself</p>
        <div role="radiogroup" aria-label="Remaining litter amount">
          <button
            className="amount-option"
            role="radio"
            aria-checked={false}
            disabled
          >
            <span className="amount-radio" />
            <span>
              <strong>None</strong>
              <small>Zero-litter recording is not available yet</small>
            </span>
          </button>
          {QUANTITY_BANDS.map((b) => (
            <button
              className="amount-option"
              role="radio"
              aria-checked={after === b}
              disabled={busy}
              key={b}
              onClick={() => {
                setAfter(b);
                setStep("linked");
                setError(null);
              }}
            >
              <span className="amount-radio" />
              <span className="grow">
                <strong>{b}</strong>
                <small>{QUANTITY_DESC[b]}</small>
              </span>
              <span style={{ fontSize: 12, color: C.dim }}>
                {"▮".repeat(CLEANUP_BAND_UNITS[b])}
              </span>
            </button>
          ))}
        </div>
        <p className="coastal-footnote">
          If more litter remains than the report describes, add a new litter
          report. Small means a small amount remains.
        </p>
      </CoastalPage>
    );
  if (step === "ai")
    return (
      <CoastalPage
        title="Check the AI Suggestion"
        eyebrow="AI suggestion · review before saving"
        subtitle="You decide the final amount. A suggestion is never saved on its own."
        tabs={false}
      >
        <button disabled={busy} onClick={() => setStep("amount")}>
          ← Choose remaining amount
        </button>
        {photoInput}
        {photoUrl && (
          <img
            src={photoUrl}
            alt="Your after-cleanup photo"
            style={{
              width: "100%",
              height: 230,
              objectFit: "contain",
              background: "#e8ecf0",
              borderRadius: 20,
            }}
          />
        )}
        {busy ? (
          <div role="status">
            <Skeleton h={140} />
            <p className="subtle">Checking the photo…</p>
          </div>
        ) : (
          <WhiteCard>
            <h2>{selected}</h2>
            <div className="band-comparison">
              <div>
                <small>Reported before</small>
                <span className="band-pill">{before}</span>
              </div>
              <span>→</span>
              <div>
                <small>AI suggests</small>
                <span className="band-pill after">
                  {suggestion ?? "No suggestion"}
                </span>
              </div>
            </div>
            <p className="subtle">
              Small or hidden litter may be missed. Check what is left before
              using the suggestion.
            </p>
          </WhiteCard>
        )}
        {error && <Alert tone="caution">{error}</Alert>}
        <PrimaryButton
          disabled={busy || !suggestion}
          onClick={() => {
            setAfter(suggestion);
            setStep("linked");
            setPhoto(null);
            setError(null);
          }}
        >
          Use {suggestion ?? "Suggestion"} <Check />
        </PrimaryButton>
        <GhostButton
          disabled={busy}
          onClick={() => {
            setStep("amount");
            setPhoto(null);
            setError(null);
          }}
        >
          Choose a Different Amount
        </GhostButton>
        <button disabled={busy} onClick={() => nav("/method/ai")}>
          How the AI Suggestion Works
        </button>
      </CoastalPage>
    );
  return (
    <CoastalPage
      title="Log Your Cleanup"
      eyebrow="Log cleanup"
      subtitle="Compare what was reported with what remains."
      back={back}
      backDisabled={busy}
      tabs={false}
      className="cleanup-alignment"
    >
      <WhiteCard>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <p className="eyebrow" style={{ margin: 0 }}>
            Linked litter report
          </p>
          <InfoChip>Counted</InfoChip>
        </div>
        <div className="coastal-link-row">
          <span className="row-thumb">
            <Pin size={22} />
          </span>
          <span>
            <strong>{target.beachName}</strong>
            <small>Counted litter report</small>
          </span>
        </div>
        {categories.length > 1 ? (
          <label
            style={{
              display: "block",
              marginTop: 16,
              fontSize: 12,
              color: C.muted,
            }}
          >
            Litter type
            <select
              aria-label="Litter type"
              value={selected}
              disabled={busy}
              onChange={(e) => {
                setCategory(e.target.value as LitterCategory);
                setAfter(null);
                setPhoto(null);
                setSuggestion(null);
                setError(null);
              }}
              style={{
                display: "block",
                width: "100%",
                marginTop: 7,
                padding: 11,
                border: "1px solid #dde3ec",
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 650,
                color: C.navy,
                background: "white",
              }}
            >
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        ) : (
          <h2 style={{ marginTop: 16 }}>{selected}</h2>
        )}
        <div className="band-comparison">
          <div>
            <small>Before cleanup</small>
            <span className="band-pill">{before}</span>
          </div>
          <span>→</span>
          <div>
            <small>Left after cleanup</small>
            <button
              className={"band-pill " + (after ? "after" : "choose")}
              disabled={busy}
              onClick={() => setStep("amount")}
            >
              {after ?? "Choose Amount"}
            </button>
          </div>
        </div>
        <p className="coastal-footnote">
          Estimate the amount left. Exact counts are not needed.
        </p>
      </WhiteCard>
      <div className="cleanup-information"><Info size={17} /><span>A later litter report is needed to show whether the beach improved.</span></div>
      {error && <Alert tone="error">{error}</Alert>}
      <PrimaryButton disabled={busy} onClick={() => void save()} trailingArrow>
        {busy ? "Saving…" : "Save Cleanup"}
      </PrimaryButton>
    </CoastalPage>
  );
}
