import { useRef, useState } from 'react';
import { twMerge } from 'tailwind-merge';

export default function Drawer({ isOpen, onClose, className, children }) {
  const drawerRef = useRef(null);
  const startY = useRef(0);
  const currentY = useRef(0);
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  if (!isOpen) return null;

  const handlePointerDown = (e) => {
    setIsDragging(true);
    startY.current = e.clientY - translateY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const deltaY = e.clientY - startY.current;
    // Only allow dragging downward
    if (deltaY >= 0) {
      currentY.current = deltaY;
      setTranslateY(deltaY);
    }
  };

  const handlePointerUp = (e) => {
    if (!isDragging) return;
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);

    if (currentY.current > 10) {
      onClose();
      setTranslateY(0);
      currentY.current = 0;
    } else {
      setTranslateY(0);
      currentY.current = 0;
    }
  };

  return (
    <div
      className="absolute inset-0 z-50 flex items-end justify-center bg-th-green-light/50 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={drawerRef}
        style={{
          transform: `translateY(${translateY}px)`,
          transition: isDragging ? 'none' : 'transform 0.2s ease-out',
        }}
        className={twMerge("flex flex-col rounded-t-3xl bg-[linear-gradient(to_bottom,var(--color-th-plain-white)_80%,var(--color-th-green-dark))] bg-size-[100%_113%] px-6 py-4 text-th-green-light items-center text-center gap-6 w-full", className)}
      >
        {/* Drag Handle Bar */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="mx-auto h-1.5 w-12 cursor-grab rounded-full bg-gray-300 active:cursor-grabbing touch-none"
        />
        {children}
      </div>
    </div>
  );
}