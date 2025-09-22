import React from "react";
import ServerCard from "../components/ServerCard.jsx";
import ServerDetail from "../components/ServerDetail.jsx";

export default function Dashboard({
  servers,
  activeServer,
  setActiveServer,
  startServer,
  stopServer
}) {
  return (
    <div className="max-w-7xl mx-auto mt-6">
      {activeServer ? (
        <ServerDetail
          server={activeServer}
          data={servers[activeServer]}
          onStart={startServer}
          onStop={stopServer}
          onBack={() => setActiveServer(null)}
        />
      ) : (
        <>
          <h1 className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-8 text-center">
            Panel de Servidores Minecraft
          </h1>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(servers).map(([name, data]) => (
              <ServerCard
                key={name}
                server={name}
                data={data}
                onStart={startServer}
                onStop={stopServer}
                onOpen={() => setActiveServer(name)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
