import { Download, Eraser, Image, Redo2, Trash2, Undo2 } from "lucide-react";
import { useEffect, type ReactNode, type Ref } from "react";

import { useStudioStore } from "@/store/studio";

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

  return (
    <TooltipProvider delayDuration={200}>
      <div ref={toolbarRef} role="group" aria-label="Drawing tools" className="absolute inset-x-0 bottom-1 z-10 mx-auto flex w-max max-w-[calc(100%-0.5rem)] flex-wrap justify-center gap-0.5 rounded-xl border border-neon/25 bg-panel/70 p-0.5 backdrop-blur-md sm:bottom-4 sm:gap-1 sm:p-1">
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
      </div>
    </TooltipProvider>
  );
}
