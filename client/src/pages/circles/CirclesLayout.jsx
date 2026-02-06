import { Outlet } from "react-router-dom";
import "./circles.css";

export default function CirclesLayout() {
  return (
    <div className="app-container circles-app">
      <div className="circles-page">
        {/* Background gradients */}
        <div className="circle-gradient-wrapper">
          <div className="circle-gradient circle-gradient-1"></div>
          <div className="circle-gradient circle-gradient-2"></div>
          <div className="circle-gradient circle-gradient-3"></div>
        </div>

        {/* This is where nested pages render */}
        <Outlet />
      </div>
    </div>
  );
}
