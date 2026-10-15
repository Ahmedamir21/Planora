import { AnimatedTooltip, type TooltipPerson } from './ui/animated-tooltip';
import { CREATOR_CREDIT } from '../config/semester';

const CREATORS: TooltipPerson[] = [
  {
    id: 1,
    name: 'Ahmed Amir',
    designation: 'IT Representative',
    image: '/team/ahmed-amir.jpg',
  },
  {
    id: 2,
    name: 'Youssef Taha',
    designation: 'AI Representative',
    image: '/team/youssef-taha.jpg',
  },
];

/** The two creators as avatars, with the credit line underneath. */
export function Creators({ align = 'center' }: { align?: 'center' | 'start' }) {
  const start = align === 'start';
  return (
    <div className={`flex flex-col gap-2 ${start ? 'items-start' : 'items-center'}`}>
      <div className={`flex w-full ${start ? 'justify-start pl-1' : 'justify-center'} pt-10`}>
        <AnimatedTooltip items={CREATORS} />
      </div>
      <p
        className="text-center text-[10px] font-bold uppercase tracking-[0.14em]"
        style={{ color: 'var(--accent)' }}
      >
        {CREATOR_CREDIT}
      </p>
    </div>
  );
}
