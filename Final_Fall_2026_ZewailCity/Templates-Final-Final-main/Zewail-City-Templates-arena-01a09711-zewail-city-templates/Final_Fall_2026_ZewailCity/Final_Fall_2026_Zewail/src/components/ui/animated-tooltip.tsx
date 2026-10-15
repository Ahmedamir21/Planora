import { useState, type MouseEvent } from 'react';
import {
  motion,
  useTransform,
  AnimatePresence,
  useMotionValue,
  useSpring,
} from 'framer-motion';
import { cn } from '../../utils/cn';

export interface TooltipPerson {
  id: number;
  name: string;
  designation: string;
  image: string;
}

// Avatars with a tooltip that tilts and follows the mouse (from 21st.dev, adapted to plain React).
export const AnimatedTooltip = ({
  items,
  className,
}: {
  items: TooltipPerson[];
  className?: string;
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const springConfig = { stiffness: 100, damping: 5 };
  const x = useMotionValue(0);
  const rotate = useSpring(useTransform(x, [-100, 100], [-45, 45]), springConfig);
  const translateX = useSpring(useTransform(x, [-100, 100], [-50, 50]), springConfig);

  const handleMouseMove = (event: MouseEvent<HTMLImageElement>) => {
    const halfWidth = event.currentTarget.offsetWidth / 2;
    x.set(event.nativeEvent.offsetX - halfWidth);
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {items.map((item) => (
        <div
          className="-mr-4 relative group"
          key={item.id}
          tabIndex={0}
          onMouseEnter={() => setHoveredIndex(item.id)}
          onMouseLeave={() => setHoveredIndex(null)}
          onFocus={() => setHoveredIndex(item.id)}
          onBlur={() => setHoveredIndex(null)}
        >
          <AnimatePresence mode="popLayout">
            {hoveredIndex === item.id && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.6 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: { type: 'spring', stiffness: 260, damping: 10 },
                }}
                exit={{ opacity: 0, y: 20, scale: 0.6 }}
                style={{
                  translateX,
                  rotate,
                  whiteSpace: 'nowrap',
                  background: 'color-mix(in srgb, var(--surface-2) 88%, transparent)',
                  border: '1px solid var(--line)',
                  WebkitBackdropFilter: 'blur(10px)',
                  backdropFilter: 'blur(10px)',
                }}
                className="absolute -top-16 -left-1/2 translate-x-1/2 flex text-xs flex-col items-center justify-center rounded-md z-50 shadow-xl px-4 py-2"
              >
                <div
                  className="absolute inset-x-10 z-30 w-[20%] -bottom-px h-px"
                  style={{ background: 'linear-gradient(to right, transparent, #10b981, transparent)' }}
                />
                <div
                  className="absolute left-10 w-[40%] z-30 -bottom-px h-px"
                  style={{ background: 'linear-gradient(to right, transparent, #0ea5e9, transparent)' }}
                />
                <div className="font-bold relative z-30 text-base" style={{ color: 'var(--ink)' }}>
                  {item.name}
                </div>
                <div className="text-xs" style={{ color: 'var(--muted)' }}>
                  {item.designation}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <img
            onMouseMove={handleMouseMove}
            height={100}
            width={100}
            src={item.image}
            alt={item.name}
            loading="lazy"
            draggable={false}
            className="object-cover object-top rounded-full h-14 w-14 border-2 group-hover:scale-105 group-hover:z-30 relative transition duration-500"
            style={{ borderColor: 'var(--paper)' }}
          />
        </div>
      ))}
    </div>
  );
};
