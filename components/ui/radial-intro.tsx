import * as React from 'react';
import {
  LayoutGroup,
  motion,
  useAnimate,
  type Transition,
  type AnimationSequence,
} from 'framer-motion';

// Helper for delay since 'delay' import might not be available in framer-motion same as motion/react
const delay = (fn: () => void, ms: number) => setTimeout(fn, ms);

interface ComponentProps {
  orbitItems: OrbitItem[];
  stageSize?: number;
  imageSize?: number;
  centerContent?: React.ReactNode;
}

export type OrbitItem = {
  id: string | number;
  name: string;
  src: string;
};

const transition: Transition = {
  delay: 0,
  stiffness: 300,
  damping: 35,
  type: 'spring',
  restSpeed: 0.01,
  restDelta: 0.01,
};

const spinConfig = {
  duration: 30,
  ease: 'linear' as const,
  repeat: Infinity,
};

const qsa = (root: Element, sel: string) =>
  Array.from(root.querySelectorAll(sel));

const angleOf = (el: Element) => Number((el as HTMLElement).dataset.angle || 0);

const armOfImg = (img: Element) =>
  (img as HTMLElement).closest('[data-arm]') as HTMLElement | null;

export const RadialIntro = ({
  orbitItems,
  stageSize = 320,
  imageSize = 60,
  centerContent
}: ComponentProps) => {
  const step = 360 / orbitItems.length;
  const [scope, animate] = useAnimate();

  React.useEffect(() => {
    const root = scope.current;
    if (!root) return;

    // get arm and image elements
    const arms = qsa(root, '[data-arm]');
    const imgs = qsa(root, '[data-arm-image]');
    const stops: Array<() => void> = [];

    // image lift-in
    delay(() => animate(imgs, { top: 0 }, transition), 250);

    // build sequence for orbit placement
    const orbitPlacementSequence: AnimationSequence = [
      ...arms.map((el): [Element, Record<string, any>, any] => [
        el,
        { rotate: angleOf(el) },
        { ...transition, at: 0 },
      ]),
      ...imgs.map((img): [Element, Record<string, any>, any] => [
        img,
        { rotate: -angleOf(armOfImg(img)!), opacity: 1 },
        { ...transition, at: 0 },
      ]),
    ];

    // play placement sequence
    delay(() => animate(orbitPlacementSequence), 700);

    // start continuous spin for arms and images
    delay(() => {
      // arms spin clockwise
      arms.forEach((el) => {
        const angle = angleOf(el);
        const ctrl = animate(el, { rotate: [angle, angle + 360] }, spinConfig);
        stops.push(() => ctrl.cancel());
      });

      // images counter-spin to stay upright
      imgs.forEach((img) => {
        const arm = armOfImg(img);
        const angle = arm ? angleOf(arm) : 0;
        const ctrl = animate(
          img,
          { rotate: [-angle, -angle - 360] },
          spinConfig,
        );
        stops.push(() => ctrl.cancel());
      });
    }, 1300);

    return () => stops.forEach((stop) => stop());
  }, [orbitItems.length]); // Re-run if items change

  return (
    <LayoutGroup>
      <div className="relative flex items-center justify-center" style={{ width: stageSize, height: stageSize }}>
        {/* Center Content */}
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          {centerContent}
        </div>

        <motion.div
          ref={scope}
          className="relative overflow-visible w-full h-full"
          initial={false}
        >
          {orbitItems.map((item, i) => (
            <motion.div
              key={item.id}
              data-arm
              className="will-change-transform absolute inset-0"
              style={{ zIndex: 1 }}
              data-angle={i * step}
              layoutId={`arm-${item.id}`}
            >
              <motion.img
                data-arm-image
                className="rounded-full object-cover absolute left-1/2 top-1/2 aspect-square translate -translate-x-1/2 border-2 border-white/10 shadow-lg"
                style={{
                  width: imageSize,
                  height: imageSize,
                  opacity: i === 0 ? 1 : 0,
                  top: '50%', // Start centered, animate to 0 (top edge) in lift-in
                }}
                src={item.src}
                alt={item.name}
                draggable={false}
                layoutId={`arm-img-${item.id}`}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </LayoutGroup>
  );
};

