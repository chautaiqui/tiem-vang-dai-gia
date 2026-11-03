import type { ReactNode } from 'react';
import { useGame } from '../../stores/gameStore';

export function Modal({ title, children, wide, closable = true, footer }: { title: ReactNode; children: ReactNode; wide?: boolean; closable?: boolean; footer?: ReactNode }) {
  const close = useGame((s) => s.closeOverlay);
  return (
    <div className="modal-backdrop">
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog">
        <header>
          <h2>{title}</h2>
          {closable && <button className="ghost" onClick={close} title="Đóng (Esc)">✕</button>}
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  );
}

export function PatienceStrip() {
  const deal = useGame((s) => s.deal);
  if (!deal) return null;
  const p = Math.max(0, deal.patience);
  return (
    <div className="patience-strip">
      <span>{deal.customer.name}</span>
      <div className="bar"><i style={{ width: `${p}%`, background: p > 60 ? '#3ecf6e' : p > 30 ? '#f2b632' : '#e5484d' }} /></div>
    </div>
  );
}
