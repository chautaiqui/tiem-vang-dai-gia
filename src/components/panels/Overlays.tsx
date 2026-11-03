import { useGame } from '../../stores/gameStore';
import { CabinetPanel } from './CabinetPanel';
import { BankruptPanel, BoardPanel, DayStartPanel, HelpPanel, SafePanel } from './InfoPanels';
import { InspectionPanel } from './InspectionPanel';
import { InvoicePanel, PaymentPanel } from './PaymentPanels';
import { PosPanel } from './PosPanel';
import { ReportPanel } from './ReportPanel';
import { ScalePanel } from './ScalePanel';

export function Overlays() {
  const overlay = useGame((s) => s.overlay);
  const hasDeal = useGame((s) => !!s.deal);
  switch (overlay) {
    case 'dayStart': return <DayStartPanel />;
    case 'cabinet': return <CabinetPanel />;
    case 'board': return <BoardPanel />;
    case 'safe': return <SafePanel />;
    case 'help': return <HelpPanel />;
    case 'report': return <ReportPanel />;
    case 'bankrupt': return <BankruptPanel />;
    case 'scale': return hasDeal ? <ScalePanel /> : null;
    case 'inspect': return hasDeal ? <InspectionPanel /> : null;
    case 'pos': return hasDeal ? <PosPanel /> : null;
    case 'payment': return hasDeal ? <PaymentPanel /> : null;
    case 'invoice': return hasDeal ? <InvoicePanel /> : null;
    default: return null;
  }
}
