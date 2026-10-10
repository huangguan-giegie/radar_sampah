import { useNavigate } from "react-router-dom";
import { GhostButton, PrimaryButton } from "../components/ui";
import { CoastalPage, DataUnavailable } from "../components/CoastalUI";

/** Unknown links used to bounce silently to the welcome page, which looked
 * like the app had lost the person's place. Say what happened instead. */
export default function NotFoundScreen() {
  const nav = useNavigate();
  return (
    <CoastalPage title="Page not found" back="/home" tabs={false}>
      <DataUnavailable title="This page doesn't exist">
        The link may be old or mistyped.
      </DataUnavailable>
      <PrimaryButton onClick={() => nav("/map")}>Open the beach map</PrimaryButton>
      <GhostButton onClick={() => nav("/home")}>Go to Home</GhostButton>
    </CoastalPage>
  );
}
