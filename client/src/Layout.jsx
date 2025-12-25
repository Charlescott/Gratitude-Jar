// import { Routes, Route, useLocation } from "react-router-dom";
// import Header from "./components/Header";
// import Home from "./pages/Home";
// import GratitudeEntries from "./pages/GratitudeEntries";
// import Register from "./pages/Register";
// import Login from "./pages/Login";

// export default function Layout({ token, onLogin, onLogout }) {
//   const location = useLocation();
//   const isAuthenticated = Boolean(token);
//   const hideHeader = location.pathname === "/";

//   return (
//     <>
//       {!hideHeader && (
//         <Header isAuthenticated={isAuthenticated} onLogout={onLogout} />
//       )}

//       <Routes>
//         <Route
//           path="/"
//           element={<Home isAuthenticated={isAuthenticated} />}
//         />

//         <Route
//           path="/entries"
//           element={
//             isAuthenticated ? (
//               <GratitudeEntries token={token} />
//             ) : (
//               <Login onLogin={onLogin} />
//             )
//           }
//         />

//         <Route path="/login" element={<Login onLogin={onLogin} />} />
//         <Route path="/register" element={<Register />} />
//       </Routes>
//     </>
//   );
// }
