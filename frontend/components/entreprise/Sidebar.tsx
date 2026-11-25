"use projet";
import { useState } from "react";
export default function Sidebar() {
    const [masquer, afficher] = useState(true);
    return (
        <aside>

            <button onClick={() => afficher(!masquer)}>
                {masquer ? "Affihcer les projets":"Masquer les projets"}
            </button>

            {masquer && (
                <select>
                    <option value="">TODOLISTE</option>
                    <option value="">Calculatrice</option>
                    <option value="">ERP</option>
                </select>
            )}

        </aside>
    );
}