import { useCallback, useEffect, useMemo, useRef } from 'react';

const SCROLL_FRACTION = 1;

const buildLinkLabel = (link) => {
  try {
    const url = new URL(link);
    return url.hostname.replace('www.', '');
  } catch (error) {
    return 'Open leak';
  }
};

const LeaksCarousel = ({
  items = [],
  loading = false,
  error = null,
  onRetry = null,
  llmInfo = null,
}) => {
  const viewportRef = useRef(null);
  const animationTimeout = useRef(null);

  const visibleItems = useMemo(() => items.filter(Boolean), [items]);

  const triggerFloatAnimation = useCallback(() => {
    if (animationTimeout.current) {
      clearTimeout(animationTimeout.current);
    }

    const viewport = viewportRef.current;
    if (!viewport) return;

    viewport.classList.add('is-animating');
    const cards = viewport.querySelectorAll('[data-carousel-card]');
    cards.forEach((card, index) => {
      card.classList.remove('is-floating');
      // Reflow to restart CSS animation
      void card.offsetWidth; // eslint-disable-line no-unused-expressions
      card.style.setProperty('--float-delay', `${index * 60}ms`);
      card.classList.add('is-floating');
    });

    animationTimeout.current = setTimeout(() => {
      viewport.classList.remove('is-animating');
    }, 520);
  }, []);

  const handleScrollBy = useCallback((direction) => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const firstCard = viewport.querySelector('[data-carousel-card]');
    const cardWidth = firstCard ? firstCard.getBoundingClientRect().width : viewport.clientWidth / 3;
    const gap = parseFloat(getComputedStyle(viewport).columnGap || getComputedStyle(viewport).gap || '24');
    const delta = (cardWidth + gap) * 3 * SCROLL_FRACTION * direction;
    viewport.scrollBy({ left: delta, behavior: 'smooth' });
    triggerFloatAnimation();
  }, [triggerFloatAnimation]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    const cards = viewport.querySelectorAll('[data-carousel-card]');
    if (!cards.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-floating');
          }
        });
      },
      {
        root: viewport,
        threshold: 0.65,
      }
    );

    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [visibleItems]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    let frame = null;
    const handleScroll = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        triggerFloatAnimation();
      });
    };

    viewport.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      viewport.removeEventListener('scroll', handleScroll);
    };
  }, [triggerFloatAnimation]);

  useEffect(() => {
    triggerFloatAnimation();
    return () => {
      if (animationTimeout.current) clearTimeout(animationTimeout.current);
    };
  }, [visibleItems, triggerFloatAnimation]);

  if (loading) {
    return (
      <div className="leaks-carousel leaks-carousel--loading">
        <div className="leaks-carousel__skeleton" aria-live="polite">
          Loading curated leaks…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="leaks-carousel leaks-carousel--error">
        <p>We couldn’t load the latest leaks: {error}</p>
        {onRetry && (
          <button type="button" className="ghost-button" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    );
  }

  if (!visibleItems.length) {
    return (
      <div className="leaks-carousel leaks-carousel--empty">
        <p>No leaks yet. Be the first to publish a document.</p>
      </div>
    );
  }

  return (
    <div className="leaks-carousel">
      <div className="leaks-carousel__controls">
        <button type="button" className="carousel-control carousel-control--prev" onClick={() => handleScrollBy(-1)} aria-label="View previous leaks">
          ←
        </button>
        <button type="button" className="carousel-control carousel-control--next" onClick={() => handleScrollBy(1)} aria-label="View next leaks">
          →
        </button>
      </div>

      <div className="leaks-carousel__meta">
        {llmInfo && !llmInfo.enabled && llmInfo.reason && (
          <span className="leaks-carousel__note">Tags auto-generated offline: {llmInfo.reason}</span>
        )}
      </div>

      <div className="leaks-carousel__viewport">
        <div className="leaks-carousel__track" ref={viewportRef}>
          {visibleItems.map((item) => {
            const statusLabel = item.status ?? (item.risk ? `${item.risk} risk` : null);
            return (
              <article key={item.id} className="leak-card" data-carousel-card>
                {statusLabel && (
                  <div className="leak-card__status" data-status={statusLabel}>
                    {statusLabel}
                  </div>
                )}
              <h3>{item.title}</h3>
              {item.insight && <p className="leak-card__insight">{item.insight}</p>}
              <p>{item.description}</p>
              {item.tags && item.tags.length > 0 && (
                <div className="leak-card__tags">
                  {item.tags.map((tag) => (
                    <span key={`${item.id}-${tag}`} className="tag">#{tag}</span>
                  ))}
                </div>
              )}
              <a className="ghost-button" href={item.link} target="_blank" rel="noopener noreferrer">
                {buildLinkLabel(item.link)} ↗
              </a>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LeaksCarousel;
