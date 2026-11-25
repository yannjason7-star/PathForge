"use client";
import { useState } from "react";
export default function EntrepriseTabs() {
    const [ongletActif, setOngletActif] = useState("projets");
    return (
        <aside>
            {/* Les boutons */}
            <button
                className={`px-4 py-2 rounded-lg transition-colors ${ongletActif === "projets"
                        ? "bg-blue-600 text-white"
                        : "bg-white text-black"
                    }`}
                onClick={() => setOngletActif("projets")}
            >
                Mes projets
            </button>
            <button className={`px-4 py-2 rounded-lg transition-colors ${
                ongletActif === "demandes" ?
                    "bg-blue-600 text-white" :
                    "bg-white text-black"
            }`}
                onClick={() => setOngletActif("demandes")}>
                Mes demandes
            </button>
            <button className={`px-4 py-2 rounded-lg transition-colors ${
                ongletActif === "factures" ?
                    "bg-blue-600 text-white" :
                    "bg-white text-black"
            }`}
                onClick={() => setOngletActif("factures")}>
                Mes factures
            </button>
            {/* Le contenu des onglets */}
            <div>
                {ongletActif === "projets" && (
                    <div>
                        <h2>Mes projets</h2>
                        <p>Voici la liste de vos projets numériques.</p>
                    </div>
                )}
                {ongletActif === "demandes" && (
                    <div>
                        <h2>Mes demandes</h2>
                        <p>Voici vos demandes de solutions numériques.</p>
                    </div>
                )}
                {ongletActif === "factures" && (
                    <div>
                        <h2>Mes factures</h2>
                        <p>Voici vos devis et factures.</p>
                    </div>
                )}
            </div>
        </aside>
    );
}