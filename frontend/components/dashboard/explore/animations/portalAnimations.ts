import gsap from 'gsap';

export const portalAnimations = {
  fadeInUp: (element: string | Element, delay = 0) => {
    return gsap.from(element, {
      opacity: 0,
      y: 30,
      duration: 1,
      delay,
      ease: 'power3.out',
    });
  },

  scaleIn: (element: string | Element, delay = 0) => {
    return gsap.from(element, {
      opacity: 0,
      scale: 0.8,
      duration: 0.6,
      delay,
      ease: 'back.out(1.7)',
    });
  },

  floatingAnimation: (element: string | Element) => {
    return gsap.to(element, {
      y: -10,
      duration: 2,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });
  },

  pulseGlow: (element: string | Element) => {
    return gsap.to(element, {
      boxShadow: '0 0 20px rgba(59, 130, 246, 0.5)',
      duration: 1.5,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });
  },
};
