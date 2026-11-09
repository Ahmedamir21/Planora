import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../utils/cn';

export interface TooltipPerson {
  id: number;
  name: string;
  designation: string;
  image: string;
}

// Avatars with a tooltip that pops up right above the hovered person (from 21st.dev, adapted to plain React).
export const AnimatedTooltip = ({
  items,
  className,
}: {
  items: TooltipPerson[];
  className?: string;
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

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
          <AnimatePresence>
            {hoveredIndex === item.id && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.85 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: { type: 'spring', stiffness: 300, damping: 20 },
                }}
                exit={{ opacity: 0, y: 10, scale: 0.85 }}
                style={{
                  x: '-50%',
                  whiteSpace: 'nowrap',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--line)',
                }}
                className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-3 flex flex-col items-center justify-center rounded-md px-4 py-2 text-xs shadow-xl"
              >
                <div
                  className="absolute left-1/2 -bottom-[6px] h-2.5 w-2.5 -translate-x-1/2 rotate-45"
                  style={{
                    background: 'var(--surface-2)',
                    borderRight: '1px solid var(--line)',
                    borderBottom: '1px solid var(--line)',
                  }}
                />
                <div className="relative z-30 text-base font-bold" style={{ color: 'var(--ink)' }}>
                  {item.name}
                </div>
                <div className="relative z-30 text-xs" style={{ color: 'var(--muted)' }}>
                  {item.designation}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <img
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
