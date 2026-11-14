import { Download, Eraser, Image, Redo2, Save, Trash2, Undo2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";

import { useStudioStore } from "@/store/studio";
import { useTracesStore } from "@/store/traces";

import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

const swatches = [
  { name: "Cyan", color: "#6ff3f0", fill: "bg-neon" },
  { name: "Pink", color: "#ff5a7a", fill: "bg-hot" },
  { name: "Lavender", color: "#b69cff", fill: "bg-[#b69cff]" },
  { name: "Mint", color: "#7dffa8", fill: "bg-[#7dffa8]" },
  { name: "White", color: "#ffffff", fill: "bg-white" },
];

interface ToolProps {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
}

function Tool({ label, pressed, onClick, children }: ToolProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          aria-pressed={pressed}
          data-dwell=""
          onClick={onClick}
          className="size-11 shrink-0 text-ink hover:bg-ink/10 aria-pressed:ring-1 aria-pressed:ring-neon"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} className="pointer-events-none">{label}</TooltipContent>
    </Tooltip>
  );
}

interface ToolbarProps {
  toolbarRef: Ref<HTMLDivElement>;
  onBeforeAction: () => void;
  onExport: (strokesOnly: boolean) => void;
}

export function Toolbar({ toolbarRef, onBeforeAction, onExport }: ToolbarProps) {
  const color = useStudioStore((state) => state.color);
  const eraser = useStudioStore((state) => state.eraser);
  const panel = useRef<HTMLDivElement>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    function handleHistory(event: KeyboardEvent) {
      if (event.defaultPrevented || !(event.ctrlKey || event.metaKey) || event.altKey ||
          event.key.toLowerCase() !== "z" ||
          (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable]"))) return;

      event.preventDefault();
      onBeforeAction();
      const { undo, redo } = useStudioStore.getState();
      if (event.shiftKey) redo();
      else undo();
    }

    document.addEventListener("keydown", handleHistory);
    return () => document.removeEventListener("keydown", handleHistory);
  }, [onBeforeAction]);

  const run = (action: () => void) => () => {
    onBeforeAction();
    action();
  };
  const { setColor, toggleEraser, undo, redo, clear } = useStudioStore.getState();

  function saveTrace() {
    const frame = panel.current?.closest(".frame");
    const video = frame?.querySelector("video");
    const drawing = frame?.querySelector<HTMLCanvasElement>("#strokes");
    if (!video?.videoWidth || !video.videoHeight || video.readyState < 2 || !drawing?.width) {
      setSaveError("Wait for the camera to be ready before saving.");
      return;
    }

    const thumbnail = document.createElement("canvas");
    const width = thumbnail.width = 320;
    const height = thumbnail.height = 180;
    const ctx = thumbnail.getContext("2d");
    if (!ctx) {
      setSaveError("Could not create a trace thumbnail.");
      return;
    }

    try {
      // Use the same centered cover geometry and mirror as the studio preview.
      const scale = Math.max(width / video.videoWidth, height / video.videoHeight);
      const cameraWidth = video.videoWidth * scale;
      const cameraHeight = video.videoHeight * scale;
      ctx.save();
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, (width - cameraWidth) / 2, (height - cameraHeight) / 2, cameraWidth, cameraHeight);
      ctx.restore();
      ctx.drawImage(drawing, 0, 0, width, height);

      const thumb = thumbnail.toDataURL("image/jpeg", 0.75);
      useTracesStore.getState().saveCurrent(useStudioStore.getState().strokes, thumb);
      setSaveError(null);
    } catch {
      setSaveError("Could not save the trace.");
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div ref={(element) => {
        panel.current = element;
        if (typeof toolbarRef === "function") return toolbarRef(element);
        if (toolbarRef) toolbarRef.current = element;
      }} role="group" aria-label="Drawing tools" className="absolute inset-x-0 bottom-1 z-10 mx-auto flex w-max max-w-[calc(100%-0.5rem)] flex-wrap justify-center gap-0.5 rounded-xl border border-neon/25 bg-panel/70 p-0.5 backdrop-blur-md sm:bottom-4 sm:gap-1 sm:p-1">
        {swatches.map((swatch) => (
          <Tool key={swatch.color} label={swatch.name} pressed={!eraser && color === swatch.color} onClick={run(() => setColor(swatch.color))}>
            <span className={"size-5 rounded-full " + swatch.fill} />
          </Tool>
        ))}
        <Tool label="Eraser" pressed={eraser} onClick={run(toggleEraser)}><Eraser /></Tool>
        <Tool label="Undo" onClick={run(undo)}><Undo2 /></Tool>
        <Tool label="Redo" onClick={run(redo)}><Redo2 /></Tool>
        <Tool label="Clear drawing" onClick={run(clear)}><Trash2 /></Tool>
        <Tool label="Export camera and strokes" onClick={run(() => onExport(false))}><Download /></Tool>
        <Tool label="Export strokes only" onClick={run(() => onExport(true))}><Image /></Tool>
        <Tool label="Save trace" onClick={run(saveTrace)}><Save /></Tool>
        {saveError && <p role="alert" className="absolute inset-x-0 bottom-full mb-2 rounded bg-panel p-2 text-center font-mono text-xs text-hot">{saveError}</p>}
      </div>
    </TooltipProvider>
  );
}
