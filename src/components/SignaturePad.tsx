import { useEffect, useRef, useState } from "react";
import { Eraser, Loader2, PenLine, X } from "lucide-react";

export function SignaturePad({ busy, onCancel, onSave }: { busy: boolean; onCancel: () => void; onSave: (file: File) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  const reset = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const context = canvas.getContext("2d"); if (!context) return;
    context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height); setHasInk(false);
  };
  useEffect(() => { reset(); }, []);
  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget; const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * (canvas.width / rect.width), y: (event.clientY - rect.top) * (canvas.height / rect.height) };
  };
  const down = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId); drawing.current = true;
    const context = event.currentTarget.getContext("2d"); if (!context) return; const p = point(event);
    context.beginPath(); context.moveTo(p.x, p.y); context.strokeStyle = "#17251d"; context.lineWidth = 3; context.lineCap = "round"; context.lineJoin = "round";
  };
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return; const context = event.currentTarget.getContext("2d"); if (!context) return;
    const p = point(event); context.lineTo(p.x, p.y); context.stroke(); setHasInk(true);
  };
  const up = () => { drawing.current = false; };
  const save = () => canvasRef.current?.toBlob((blob) => { if (blob) onSave(new File([blob], `signature-${Date.now()}.png`, { type: "image/png" })); }, "image/png");

  return <div className="fixed inset-0 z-50 bg-black/80 p-4 flex items-end sm:items-center justify-center">
    <div className="w-full max-w-lg rounded-3xl bg-white text-forest-900 p-4 shadow-2xl">
      <div className="flex items-center justify-between"><div><h2 className="font-bold flex items-center gap-2"><PenLine className="w-5 h-5"/> Mijoz imzosi</h2><p className="text-xs text-slate-500 mt-1">Qabul qiluvchi quyidagi maydonga imzo qo‘yadi</p></div><button onClick={onCancel} className="p-2 rounded-xl bg-cream-100"><X className="w-5 h-5"/></button></div>
      <canvas ref={canvasRef} width={900} height={420} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} className="mt-4 w-full h-52 rounded-2xl border-2 border-dashed border-cream-300 bg-white touch-none" />
      <div className="grid grid-cols-3 gap-2 mt-3"><button onClick={reset} className="py-3 rounded-xl bg-cream-100 text-slate-600 flex items-center justify-center gap-2"><Eraser className="w-4 h-4"/> Tozalash</button><button onClick={onCancel} className="py-3 rounded-xl bg-slate-100 text-slate-600">Bekor</button><button disabled={!hasInk || busy} onClick={save} className="py-3 rounded-xl bg-leaf-500 text-forest-900 font-bold disabled:opacity-40">{busy ? <Loader2 className="w-5 h-5 animate-spin mx-auto"/> : "Saqlash"}</button></div>
    </div>
  </div>;
}
