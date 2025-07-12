import React, { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState("dark");

  // useEffect(() => {
  //   const savedTheme = typeof window !== "undefined" && localStorage.getItem("theme");
  //   if (savedTheme) {
  //     setTheme(savedTheme);
  //     document.documentElement.classList.toggle("dark", savedTheme === "dark");
  //   } else {
  //     const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  //     setTheme(prefersDark ? "dark" : "light");
  //     document.documentElement.classList.toggle("dark", prefersDark);
  //   }
  // }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    // if (typeof window !== "undefined") {
    //   localStorage.setItem("theme", newTheme);
    //   document.documentElement.classList.toggle("dark", newTheme === "dark");
    // }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
