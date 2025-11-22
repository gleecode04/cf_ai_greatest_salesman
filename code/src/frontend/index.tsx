/**
 * Main Entry Point
 * Simple routing for React app
 */

import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import ChatPage from "./pages/ChatPage";
import ReportPage from "./pages/ReportPage";
import HomePage from "./pages/HomePage";

function App() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    // Listen for popstate (back/forward buttons)
    const handlePopState = (e: PopStateEvent) => {
      // Check if feedback is being generated
      const isGeneratingFeedback = sessionStorage.getItem('isGeneratingFeedback') === 'true';
      if (isGeneratingFeedback) {
        // Prevent navigation - push current path back
        window.history.pushState({}, '', path);
        alert("Please wait for feedback generation to complete before navigating.");
        return;
      }
      setPath(window.location.pathname);
    };

    // Listen for navigation (when links are clicked)
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a[href^="/"]');
      if (link) {
        // Check if feedback is being generated
        const isGeneratingFeedback = sessionStorage.getItem('isGeneratingFeedback') === 'true';
        if (isGeneratingFeedback) {
          e.preventDefault();
          e.stopPropagation();
          alert("Please wait for feedback generation to complete before navigating.");
          return;
        }
        
        e.preventDefault();
        const href = link.getAttribute('href');
        if (href) {
          window.history.pushState({}, '', href);
          setPath(href);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    document.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('click', handleClick);
    };
  }, []);

  console.log('[App] Current path:', path);

  if (path === "/report" || path === "/report.html") {
    console.log('[App] Rendering ReportPage');
    return <ReportPage />;
  }

  if (path === "/chat" || path === "/chat.html") {
    console.log('[App] Rendering ChatPage');
    return <ChatPage />;
  }

  // Default to home page (stats/overview)
  console.log('[App] Rendering HomePage');
  return <HomePage />;
}

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element not found");
}

const root = createRoot(container);
root.render(<App />);

