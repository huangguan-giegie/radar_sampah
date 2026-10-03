import { useLocation, useNavigate } from "react-router-dom";
import { USE_MOCK } from "../api";
import { BarChart, BookmarkIcon, CommunityIcon, HomeIcon, Pin, UserIcon } from "./Icon";

const TABS = [
  { to: "/map", label: "Map", Icon: Pin },
  USE_MOCK
    ? { to: "/insights", label: "Insights", Icon: BarChart }
    : { to: "/reports", label: "My Reports", Icon: BookmarkIcon },
  { to: "/home", label: "Home", Icon: HomeIcon },
  { to: "/community", label: "Community", Icon: CommunityIcon },
  { to: "/account", label: "Account", Icon: UserIcon },
];

export function TabBar() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  return (
    <nav className="coastal-tabs" aria-label="Main navigation">
      {TABS.map(({ to, label, Icon }) => (
        <button
          key={to}
          onClick={() => nav(to)}
          className={to === "/home" ? "home-tab" : ""}
          aria-current={
            pathname === to || (to !== "/home" && pathname.startsWith(to + "/"))
              ? "page"
              : undefined
          }
        >
          <span className="tab-icon">
            <Icon size={22} color="currentColor" />
          </span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
