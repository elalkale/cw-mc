import React from "react";
import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 text-center p-8">
      <h1 className="text-4xl font-extrabold text-purple-600 dark:text-purple-400 mb-6">
        Bienvenido al Panel de Minecraft
      </h1>

      <h2 className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-4">Developed By Alejandro R. and Jesús G.</h2>
      <img
        src="frontend\src\assets\creators.jpg"
        alt="Alejandro R. y Jesús G."
        className="w-64 h-64 rounded-full mb-6 object-cover shadow-lg"
      ></img>
      <p className="text-gray-700 dark:text-gray-300 mb-8 max-w-lg">
        Administra fácilmente tus servidores de Minecraft. Inicia, detén y controla cada servidor desde un solo lugar.
      </p>
      <Link
        to="/dashboard"
        className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold shadow-md transition transform hover:scale-105"
      >
        Ir al Dashboard
      </Link>
    </div>
  );
}
