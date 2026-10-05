import React, { useRef, useState, useEffect } from 'react';
import { ArrowUp, LifeBuoy, Flame, Hand, Eye, Compass, Smartphone, Tablet } from 'lucide-react';

interface MobileControlsProps {
  onMove: (x: number, y: number) => void;
  onJump: () => void;
  onInteract: () => void;
  onFlare: () => void;
  onGrab: (isGrabbing: boolean) => void;
  onToggleCamera: () => void;
  flaresLeft: number;
  isGrabbing: boolean;
  grabStamina: number;
  isSinkingPhase: boolean;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  onMove,
  onJump,
  onInteract,
  onFlare,
  onGrab,
  onToggleCamera,
  flaresLeft,
  isGrabbing,
  grabStamina,
  isSinkingPhase,
}) => {
  const touchSurfaceRef = useRef<HTMLDivElement>(null);
  const activeTouchId = useRef<number | null>(null);

  // Tablet thumbstick state
  const [baseCenter, setBaseCenter] = useState<{ x: number; y: number } | null>(null);
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isActive, setIsActive] = useState<boolean>(false);
  const [isTabletSize, setIsTabletSize] = useState<boolean>(true);
  const [joystickMode, setJoystickMode] = useState<'dynamic' | 'fixed'>('dynamic');

  // Detect tablet or large screen on mount
  useEffect(() => {
    const checkTablet = () => {
      const isTabletScreen = window.innerWidth >= 700 || window.innerHeight >= 700;
      setIsTabletSize(isTabletScreen);
    };
    checkTablet();
    window.addEventListener('resize', checkTablet);
    return () => window.removeEventListener('resize', checkTablet);
  }, []);

  // Stroke radius: Tablet gets a wide, ergonomic travel range (72px)
  const maxRadius = isTabletSize ? 72 : 50;

  // Process touch coordinates relative to thumbstick center
  const processTouchCoords = (clientX: number, clientY: number) => {
    if (!touchSurfaceRef.current) return;
    const surfaceRect = touchSurfaceRef.current.getBoundingClientRect();

    let centerX: number;
    let centerY: number;

    if (baseCenter) {
      centerX = surfaceRect.left + baseCenter.x;
      centerY = surfaceRect.top + baseCenter.y;
    } else {
      // Default resting center (comfortable tablet thumb position)
      const defaultRestX = isTabletSize ? 110 : 80;
      const defaultRestY = surfaceRect.height - (isTabletSize ? 110 : 80);
      centerX = surfaceRect.left + defaultRestX;
      centerY = surfaceRect.top + defaultRestY;
    }

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const distance = Math.hypot(dx, dy);

    // Clamped radius
    const clampedDist = Math.min(distance, maxRadius);
    const angle = Math.atan2(dy, dx);

    const targetX = Math.cos(angle) * clampedDist;
    const targetY = Math.sin(angle) * clampedDist;

    setKnobOffset({ x: targetX, y: targetY });

    // Deadzone and continuous analog vector
    const deadzone = 6;
    if (clampedDist > deadzone) {
      const normalizedMagnitude = (clampedDist - deadzone) / (maxRadius - deadzone);
      const normX = Math.cos(angle) * normalizedMagnitude;
      const normY = -Math.sin(angle) * normalizedMagnitude; // inverted screen Y -> forward Z
      onMove(normX, normY);
    } else {
      onMove(0, 0);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (activeTouchId.current !== null) return;
    const touch = e.changedTouches[0];
    activeTouchId.current = touch.identifier;

    if (!touchSurfaceRef.current) return;
    const surfaceRect = touchSurfaceRef.current.getBoundingClientRect();
    const relX = touch.clientX - surfaceRect.left;
    const relY = touch.clientY - surfaceRect.top;

    if (joystickMode === 'dynamic') {
      // Dynamic floating: center the thumbstick directly under the player's tablet thumb!
      setBaseCenter({ x: relX, y: relY });
    }

    setIsActive(true);
    processTouchCoords(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (activeTouchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeTouchId.current) {
        processTouchCoords(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
        break;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (activeTouchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeTouchId.current) {
        activeTouchId.current = null;
        setIsActive(false);
        setKnobOffset({ x: 0, y: 0 });
        if (joystickMode === 'dynamic') {
          // Keep base visible briefly or return to natural resting spot
          setTimeout(() => {
            if (activeTouchId.current === null) {
              setBaseCenter(null);
            }
          }, 350);
        }
        onMove(0, 0);
        break;
      }
    }
  };

  // Mouse fallback for testing in browser / emulator
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!touchSurfaceRef.current) return;
    const surfaceRect = touchSurfaceRef.current.getBoundingClientRect();
    const relX = e.clientX - surfaceRect.left;
    const relY = e.clientY - surfaceRect.top;

    if (joystickMode === 'dynamic') {
      setBaseCenter({ x: relX, y: relY });
    }
    setIsActive(true);

    const onMouseMove = (moveEv: MouseEvent) => {
      processTouchCoords(moveEv.clientX, moveEv.clientY);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setIsActive(false);
      setKnobOffset({ x: 0, y: 0 });
      setBaseCenter(null);
      onMove(0, 0);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Default resting center coordinates
  const defaultRestPos = {
    x: isTabletSize ? 115 : 85,
    y: isTabletSize ? 115 : 85,
  };

  const currentCenter = baseCenter || {
    x: defaultRestPos.x,
    y: typeof window !== 'undefined' ? (window.innerHeight * 0.7) - defaultRestPos.y : defaultRestPos.y,
  };

  return (
    <>
      {/* 
        EXPANSIVE TABLET THUMBSTICK TOUCH ZONE 
        Covers the entire left 46% of the screen, height 70% from bottom!
        Touching anywhere in this zone captures your left thumb and brings the joystick to you.
      */}
      <div
        ref={touchSurfaceRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onMouseDown={handleMouseDown}
        className="fixed left-0 bottom-0 w-[46vw] h-[72vh] z-30 pointer-events-auto touch-none select-none"
      >
        {/* Analog Thumbstick Base */}
        <div
          className={`absolute rounded-full border-2 transition-all duration-100 flex items-center justify-center backdrop-blur-md shadow-2xl pointer-events-none ${
            isTabletSize ? 'w-44 h-44' : 'w-32 h-32'
          } ${
            isActive
              ? 'bg-slate-950/90 border-sky-400 ring-4 ring-sky-500/30 scale-105'
              : 'bg-slate-950/65 border-slate-700/80'
          }`}
          style={{
            left: `${baseCenter ? baseCenter.x : defaultRestPos.x}px`,
            top: `${baseCenter ? baseCenter.y : 'auto'}`,
            bottom: baseCenter ? 'auto' : `${defaultRestPos.y - (isTabletSize ? 88 : 64)}px`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {/* Degree ticks / compass ring */}
          <div className="absolute inset-2 rounded-full border border-slate-800/80 pointer-events-none" />

          {/* Compass Cardinal Points */}
          <div className="absolute top-2 text-[10px] md:text-xs font-bold text-sky-400 tracking-wider">▲ N</div>
          <div className="absolute bottom-2 text-[10px] md:text-xs font-bold text-slate-500 tracking-wider">▼ S</div>
          <div className="absolute left-2 text-[10px] md:text-xs font-bold text-slate-500 tracking-wider">◄ W</div>
          <div className="absolute right-2 text-[10px] md:text-xs font-bold text-slate-500 tracking-wider">E ►</div>

          {/* Internal crosshairs */}
          <div className="absolute inset-x-7 top-1/2 h-[1px] bg-slate-800/90 pointer-events-none" />
          <div className="absolute inset-y-7 left-1/2 w-[1px] bg-slate-800/90 pointer-events-none" />

          {/* Connected directional ray from center to knob */}
          {isActive && (
            <div
              className="absolute left-1/2 top-1/2 h-1 bg-gradient-to-r from-sky-500/40 via-sky-400 to-sky-300 origin-left pointer-events-none rounded-full"
              style={{
                width: `${Math.hypot(knobOffset.x, knobOffset.y)}px`,
                transform: `rotate(${Math.atan2(knobOffset.y, knobOffset.x)}rad)`,
              }}
            />
          )}

          {/* Central Thumbstick Knob */}
          <div
            className={`rounded-full border-2 shadow-2xl flex items-center justify-center pointer-events-none transition-transform duration-75 ${
              isTabletSize ? 'w-20 h-20' : 'w-14 h-14'
            } ${
              isActive
                ? 'bg-gradient-to-tr from-sky-600 via-sky-500 to-sky-400 border-white text-white shadow-sky-400/50 scale-105'
                : 'bg-gradient-to-tr from-slate-800 via-slate-750 to-slate-700 border-slate-500 text-slate-300 shadow-xl'
            }`}
            style={{
              transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
            }}
          >
            <Compass className={`${isTabletSize ? 'w-9 h-9' : 'w-6 h-6'} ${isActive ? 'animate-spin' : ''}`} />
          </div>
        </div>

        {/* Tablet Indicator Badge */}
        {!isActive && (
          <div
            className="absolute pointer-events-none flex flex-col items-center gap-1 opacity-90 transition-opacity"
            style={{
              left: `${defaultRestPos.x}px`,
              bottom: `${defaultRestPos.y + (isTabletSize ? 96 : 76)}px`,
              transform: 'translateX(-50%)',
            }}
          >
            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-950/80 border border-sky-500/40 rounded-full shadow-lg backdrop-blur-md">
              <Tablet className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-sky-300 whitespace-nowrap">
                Tablet Thumbstick
              </span>
            </div>
            <span className="text-[9px] text-slate-400 font-medium whitespace-nowrap">
              Touch anywhere on left half to move
            </span>
          </div>
        )}
      </div>

      {/* 
        RIGHT ACTION ZONE: Tablet Ergonomic Action & Grab Buttons 
        Spaced comfortably for natural right thumb reach on tablet bezel
      */}
      <div className="fixed right-3 md:right-8 bottom-4 md:bottom-8 z-30 pointer-events-none flex flex-col items-end gap-3 md:gap-4 select-none">
        {/* Tablet Mode Quick Toggle */}
        <div className="pointer-events-auto flex items-center gap-2 mb-1">
          <button
            onClick={() => setIsTabletSize(!isTabletSize)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/75 border border-slate-800 hover:border-sky-500/50 text-[10px] font-mono-tabular text-slate-300 backdrop-blur-md shadow-lg cursor-pointer transition-colors active:scale-95"
            title="Toggle Tablet / Compact Joystick Size"
          >
            {isTabletSize ? (
              <>
                <Tablet className="w-3 h-3 text-sky-400" />
                <span>Tablet XL Stick</span>
              </>
            ) : (
              <>
                <Smartphone className="w-3 h-3 text-amber-400" />
                <span>Compact Stick</span>
              </>
            )}
          </button>
        </div>

        {/* Top Mini Actions Row */}
        <div className="pointer-events-auto flex items-center gap-2.5 md:gap-3">
          {/* Camera View Switch (1st / 3rd Person) */}
          <button
            onTouchStart={(e) => {
              e.preventDefault();
              onToggleCamera();
            }}
            onClick={onToggleCamera}
            className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center shadow-xl active:scale-90 transition-transform cursor-pointer"
            title="Toggle View (V)"
          >
            <Eye className="w-5 h-5 md:w-7 md:h-7" />
          </button>

          {/* Interact / Lifeboat [E] */}
          <button
            onTouchStart={(e) => {
              e.preventDefault();
              onInteract();
            }}
            onClick={onInteract}
            className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border-2 border-sky-400/90 text-sky-300 flex items-center justify-center shadow-xl active:scale-90 transition-transform cursor-pointer"
            title="Board Lifeboat / Interact [E]"
          >
            <LifeBuoy className="w-6 h-6 md:w-8 md:h-8" />
          </button>

          {/* Flare Launch [F] */}
          {isSinkingPhase && (
            <button
              onTouchStart={(e) => {
                e.preventDefault();
                onFlare();
              }}
              onClick={onFlare}
              disabled={flaresLeft <= 0}
              className={`w-12 h-12 md:w-16 md:h-16 rounded-2xl border-2 flex items-center justify-center shadow-xl active:scale-90 transition-transform cursor-pointer ${
                flaresLeft > 0
                  ? 'bg-rose-950/90 border-rose-500 text-amber-300 shadow-rose-950/60'
                  : 'bg-slate-900/60 border-slate-800 text-slate-600'
              }`}
              title="Launch Signal Flare [F]"
            >
              <Flame className="w-6 h-6 md:w-8 md:h-8" />
            </button>
          )}
        </div>

        {/* Primary Bottom Actions: GRAB & JUMP */}
        <div className="pointer-events-auto flex items-center gap-3 md:gap-4">
          {/* DEDICATED TABLET GRAB BUTTON (HOLD TO GRAB ONTO SHIP) */}
          {isSinkingPhase && (
            <button
              onTouchStart={(e) => {
                e.preventDefault();
                onGrab(true);
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                onGrab(false);
              }}
              onTouchCancel={(e) => {
                e.preventDefault();
                onGrab(false);
              }}
              onMouseDown={() => onGrab(true)}
              onMouseUp={() => onGrab(false)}
              onMouseLeave={() => {
                if (isGrabbing) onGrab(false);
              }}
              className={`relative flex flex-col items-center justify-center w-20 h-20 md:w-24 md:h-24 rounded-2xl md:rounded-3xl border-2 md:border-3 shadow-2xl transition-all active:scale-95 touch-none cursor-pointer ${
                isGrabbing
                  ? 'bg-amber-500 border-amber-300 text-slate-950 ring-4 ring-amber-400/60 scale-105'
                  : 'bg-slate-900/90 border-amber-500/80 text-amber-300 hover:bg-slate-800'
              }`}
            >
              <Hand className="w-8 h-8 md:w-10 md:h-10 fill-current" />
              <span className="text-[11px] md:text-xs font-bold tracking-tight mt-1 uppercase">
                {isGrabbing ? 'HOLDING' : 'GRAB'}
              </span>

              {/* Grip Stamina Indicator Bar */}
              <div className="absolute -top-2.5 inset-x-2.5 h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800 shadow-inner">
                <div
                  className={`h-full transition-all duration-75 ${
                    grabStamina > 30 ? 'bg-amber-400' : 'bg-rose-500 animate-pulse'
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, grabStamina))}%` }}
                />
              </div>
            </button>
          )}

          {/* TABLET JUMP BUTTON */}
          <button
            onTouchStart={(e) => {
              e.preventDefault();
              onJump();
            }}
            onClick={onJump}
            className="w-20 h-20 md:w-24 md:h-24 rounded-2xl md:rounded-3xl bg-sky-600 hover:bg-sky-500 border-2 md:border-3 border-sky-400 text-white flex flex-col items-center justify-center shadow-2xl active:scale-90 transition-transform cursor-pointer"
          >
            <ArrowUp className="w-9 h-9 md:w-11 md:h-11" />
            <span className="text-[11px] md:text-xs font-bold tracking-tight uppercase">Jump</span>
          </button>
        </div>
      </div>
    </>
  );
};
