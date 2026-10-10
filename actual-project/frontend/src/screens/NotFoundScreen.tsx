import { useNavigate } from 'react-router-dom';
import { CoastalPage, WhiteCard } from '../components/CoastalUI';
import { GhostButton, PrimaryButton } from '../components/ui';

export default function NotFoundScreen() {
  const nav = useNavigate();
  return <CoastalPage title="Page not found" eyebrow="404" tabs={false}>
    <WhiteCard>
      <p className="subtle">This link may be out of date or the address may be incorrect.</p>
      <div className="not-found-actions">
        <PrimaryButton onClick={() => nav('/home', { replace: true })}>Go to Home</PrimaryButton>
        <GhostButton onClick={() => nav('/map', { replace: true })}>Explore Beaches</GhostButton>
      </div>
    </WhiteCard>
  </CoastalPage>;
}
