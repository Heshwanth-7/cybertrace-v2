function init() {
  gsap.registerPlugin(ScrollTrigger);

  const preloader = document.querySelector('.preloader');
  const lines = gsap.utils.toArray('#hero .line-inner');
  const introDetails = '.lead, .nav, .scroll-hint';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    preloader.hidden = true;
    gsap.set(preloader, { display: 'none' });
    gsap.set(lines, { transform: 'none' });
    return;
  }

  // Smooth scrolling and section links.
  const lenis = new Lenis({
    duration: 1.2,
    easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  });

  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();

  let preloading = true;
  let pendingAnchor;
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const link = event.target.closest('a[href="#how"], a[href="#studio"], a[href="#gallery"]');
    if (!link) return;

    event.preventDefault();
    if (window.location.hash !== link.hash) history.pushState(null, '', link.hash);
    if (preloading) {
      pendingAnchor = link.hash;
    } else {
      lenis.scrollTo(link.hash);
    }
  });

  // Preloader and hero intro.
  const count = document.querySelector('#count');
  const counter = { value: 0 };
  gsap.set(lines, { y: 0, yPercent: 110 });
  gsap.set(introDetails, { opacity: 0 });
  gsap.set('.preloader .progress-line', { scaleX: 0 });

  gsap.timeline({
    onComplete() {
      preloader.hidden = true;
      gsap.set(preloader, { display: 'none' });
      preloading = false;
      lenis.start();
      if (pendingAnchor) lenis.scrollTo(pendingAnchor);

      gsap.timeline()
        .to(lines, { yPercent: 0, stagger: 0.12, duration: 1.3, ease: 'expo.out' })
        .to(introDetails, { opacity: 1, duration: 0.5, stagger: 0.08, ease: 'power2.out' });
    },
  })
    .to(counter, {
      value: 100,
      duration: 1.8,
      ease: 'power2.inOut',
      onUpdate() {
        count.textContent = Math.round(counter.value);
      },
    })
    .to('.preloader .progress-line', { scaleX: 1, duration: 1.8, ease: 'power2.inOut' }, 0)
    .to(preloader, { yPercent: -100, duration: 1, ease: 'expo.inOut' });

  // Custom cursor.
  if (!window.matchMedia('(hover: none)').matches) {
    const ring = document.querySelector('.cursor');
    const dot = document.querySelector('.cursor-dot');
    gsap.set([ring, dot], { xPercent: -50, yPercent: -50, opacity: 0 });

    const ringX = gsap.quickTo(ring, 'x', { duration: 0.5, ease: 'power3.out' });
    const ringY = gsap.quickTo(ring, 'y', { duration: 0.5, ease: 'power3.out' });
    const dotX = gsap.quickTo(dot, 'x', { duration: 0.1, ease: 'power3.out' });
    const dotY = gsap.quickTo(dot, 'y', { duration: 0.1, ease: 'power3.out' });
    let cursorVisible = false;

    window.addEventListener('pointermove', event => {
      if (event.pointerType === 'touch') return;

      const { clientX, clientY } = event;
      ringX(clientX, cursorVisible ? undefined : clientX);
      ringY(clientY, cursorVisible ? undefined : clientY);
      dotX(clientX, cursorVisible ? undefined : clientX);
      dotY(clientY, cursorVisible ? undefined : clientY);
      ring.classList.toggle('is-hover', Boolean(event.target.closest('a, button, .magnetic, .swatch')));

      if (!cursorVisible) {
        gsap.set([ring, dot], { opacity: 1 });
        cursorVisible = true;
      }
    }, { passive: true });

    document.documentElement.addEventListener('pointerleave', () => {
      gsap.set([ring, dot], { opacity: 0 });
      cursorVisible = false;
    });
  }

  // One-time viewport reveals.
  for (const element of document.querySelectorAll('[data-reveal], h2')) {
    gsap.from(element, {
      opacity: 0,
      y: 24,
      duration: 0.65,
      ease: 'power2.out',
      scrollTrigger: { trigger: element, start: 'top 85%', once: true },
    });
  }
}

init();

if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  // Marquee speed and direction follow the latest scroll.
  const marqueeLoop = gsap.to('.marquee-track', {
    xPercent: -50,
    repeat: -1,
    duration: 25,
    ease: 'none',
    onReverseComplete() {
      this.totalTime(this.totalTime() + this.duration() * 100);
    },
  });

  ScrollTrigger.create({
    onUpdate(self) {
      const velocity = self.getVelocity();
      if (!velocity) return;

      const direction = Math.sign(velocity);
      const speed = 1 + Math.min(Math.abs(velocity) / 800, 5);
      gsap.timeline({ defaults: { overwrite: 'auto' } })
        .to(marqueeLoop, { timeScale: direction * speed, duration: 0.15, ease: 'power2.out' })
        .to(marqueeLoop, { timeScale: direction, duration: 0.85, ease: 'power2.out' });
    },
  });

  // Pin the gesture cards and highlight each as it crosses the center.
  const pin = document.querySelector('#how .pin-wrap');
  const track = pin.querySelector('.h-track');
  const howLayout = gsap.matchMedia();
  howLayout.add('(width < 768px)', () => {
    track.setAttribute('data-lenis-prevent-horizontal', '');
    return () => track.removeAttribute('data-lenis-prevent-horizontal');
  });
  howLayout.add('(min-width: 768px)', () => {
    const travel = () => Math.max(0, track.scrollWidth - window.innerWidth);
    const horizontalScroll = gsap.to(track, {
      x: () => -travel(),
      ease: 'none',
      scrollTrigger: {
        trigger: pin,
        start: 'top top',
        end: () => '+=' + travel(),
        pin: true,
        scrub: 1,
        invalidateOnRefresh: true,
      },
    });

    for (const step of track.querySelectorAll('.step')) {
      gsap.timeline({
        scrollTrigger: {
          trigger: step,
          containerAnimation: horizontalScroll,
          start: 'center 85%',
          end: 'center 15%',
          scrub: true,
        },
      })
        .fromTo(step, { scale: 0.95, opacity: 0.7 }, { scale: 1, opacity: 1, ease: 'power1.out' })
        .to(step, { scale: 0.95, opacity: 0.7, ease: 'power1.in' });
    }
  });

  // Magnetic controls use the resting bounds while the pointer is over them.
  if (window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 769px)').matches) {
    for (const button of document.querySelectorAll('.magnetic')) {
      const moveX = gsap.quickTo(button, 'x', { duration: 0.3, ease: 'power2.out' });
      const moveY = gsap.quickTo(button, 'y', { duration: 0.3, ease: 'power2.out' });
      let reset;
      let centerX;
      let centerY;

      button.addEventListener('mouseenter', () => {
        reset?.kill();
        const rect = button.getBoundingClientRect();
        centerX = rect.left + rect.width / 2 - Number(gsap.getProperty(button, 'x'));
        centerY = rect.top + rect.height / 2 - Number(gsap.getProperty(button, 'y'));
      });

      button.addEventListener('mousemove', event => {
        moveX((event.clientX - centerX) * 0.25);
        moveY((event.clientY - centerY) * 0.25);
      });

      button.addEventListener('mouseleave', () => {
        moveX.tween.pause();
        moveY.tween.pause();
        reset = gsap.to(button, { x: 0, y: 0, duration: 0.8, ease: 'elastic.out(1, 0.4)' });
      });
    }
  }

  // Parallax distances are expressed in pixels.
  for (const element of document.querySelectorAll('[data-speed]')) {
    const distance = Number(element.dataset.speed);
    if (!Number.isFinite(distance) || distance === 0) continue;

    gsap.to(element, {
      y: -distance,
      ease: 'none',
      scrollTrigger: { trigger: element, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  }

  // Reveal the footer word through a stationary clipping wrapper.
  const footerWord = document.querySelector('.footer-word');
  const footerMask = document.createElement('div');
  footerMask.style.overflow = 'hidden';
  footerWord.before(footerMask);
  footerMask.append(footerWord);
  gsap.from(footerWord, {
    yPercent: 100,
    duration: 1.2,
    ease: 'expo.out',
    scrollTrigger: { trigger: footerMask, start: 'top 90%', once: true },
  });

  const refresh = () => ScrollTrigger.refresh();
  if (document.readyState === 'complete') {
    refresh();
  } else {
    window.addEventListener('load', refresh, { once: true });
  }
  document.fonts.ready.then(refresh);
}
