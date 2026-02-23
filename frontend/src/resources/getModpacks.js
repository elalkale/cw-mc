import { log } from "console";
import fs from "fs";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.CURSEFORGE_API_TOKEN;
const gameId = 432;       // Minecraft
const classId = 4471;     // Modpacks
const pageSize = 50;

// Versiones importantes (puedes ampliar la lista)
const gameVersions = [
    "1.21.1",
    "1.21",
    "1.20.1",
    "1.20",
    "1.19.2",
    "1.18.2"
];

// Forge, Fabric, Quilt, NeoForge
const modLoaders = [1, 4, 5, 6];

function writeToFile(filename, content) {
    fs.writeFile(filename, content, (err) => {
        if (err) {
            console.error(`Error al escribir en ${filename}:`, err);
        } else {
            console.log(`Archivo ${filename} guardado exitosamente.`);
        }
    });
}

async function getCategories() {
    const resp = await fetch(`https://api.curseforge.com/v1/categories?gameId=${gameId}`, {
        headers: { "x-api-key": API_KEY, "Accept": "application/json" }
    });
    const data = await resp.json();
    console.log(data.data);

    writeToFile("categories.json", JSON.stringify(data.data, null, 2));
}

async function buscarModpacksConServer() {

    const modpacksConServer = new Map();

    for (const version of gameVersions) {
        for (const loader of modLoaders) {

            log(`\n🔎 Buscando versión ${version} con loader ${loader}`);

            let index = 0;

            while (true) {

                // evitar límite 10k
                if (index + pageSize > 10000) {
                    log("⚠️ Límite 10k alcanzado en esta combinación.");
                    break;
                }

                // descanso anti rate limit
                await new Promise(resolve => setTimeout(resolve, 500));

                const searchUrl =
                    `https://api.curseforge.com/v1/mods/search` +
                    `?gameId=${gameId}` +
                    `&classId=${classId}` +
                    `&gameVersion=${version}` +
                    `&modLoaderType=${loader}` +
                    `&sortField=3` +
                    `&sortOrder=desc` +
                    `&pageSize=${pageSize}` +
                    `&index=${index}`;

                let data;

                try {
                    const response = await fetch(searchUrl, {
                        headers: {
                            "Accept": "application/json",
                            "x-api-key": API_KEY
                        }
                    });

                    if (!response.ok) {
                        log("⚠️ Error:", response.status);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        continue;
                    }

                    data = await response.json();

                } catch (err) {
                    console.error("Error de red:", err);
                    break;
                }

                if (!data.data || data.data.length === 0) break;

                for (const mod of data.data) {

                    const files = mod.latestFiles || [];
                    let serverFileId;

                    for (const file of files) {
                        if (file.serverPackFileId) {
                            serverFileId = file.serverPackFileId;
                            log(`✅ Modpack encontrado: ${mod.name} (ID: ${mod.id}) con server pack ID: ${serverFileId}`);
                            break;
                        }
                    }

                    // Solo guardar modpacks que tengan server pack
                    if (serverFileId) {
                        modpacksConServer.set(mod.id, {
                            modId: mod.id,
                            name: mod.name,
                            slug: mod.slug,

                            downloadCount: mod.downloadCount,
                            gamePopularityRank: mod.gamePopularityRank,
                            thumbsUpCount: mod.thumbsUpCount,
                            isFeatured: mod.isFeatured,
                            isAvailable: mod.isAvailable,

                            primaryCategoryId: mod.primaryCategoryId,
                            categories: (mod.categories || []).map(c => c.id),

                            modLoaders: [...new Set((mod.latestFilesIndexes || []).map(f => f.modLoader).filter(Boolean))],
                            gameVersions: [...new Set((mod.latestFilesIndexes || []).map(f => f.gameVersion).filter(Boolean))],

                            dateCreated: mod.dateCreated,
                            dateModified: mod.dateModified,
                            dateReleased: mod.dateReleased,

                            serverFileId
                        });
                    }
                }

                index += pageSize;
            }
        }
    }

    const resultado = Array.from(modpacksConServer.values());

    if (resultado.length === 0) {
        log("No se encontraron modpacks con server packs.");
    } else {
        writeToFile(
            "modpacks_with_server.json",
            JSON.stringify(resultado, null, 2)
        );
        log(`\n🎉 Total únicos encontrados: ${resultado.length}`);
    }
}

buscarModpacksConServer();