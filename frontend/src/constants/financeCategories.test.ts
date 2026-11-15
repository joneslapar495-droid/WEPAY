import {
  CATEGORIAS_GRUPO,
  CATEGORIAS_PESSOAIS,
  CATEGORIAS_RECIBO,
  ICONES_CATEGORIA,
  mesclarCategorias,
} from "@/constants/financeCategories";

describe("finance category options", () => {
  it("offers a large set of unique category icons", () => {
    expect(ICONES_CATEGORIA.length).toBeGreaterThan(110);
    expect(new Set(ICONES_CATEGORIA).size).toBe(ICONES_CATEGORIA.length);
    expect(ICONES_CATEGORIA).toContain("🛋️");
    expect(ICONES_CATEGORIA).toContain("🧴");
    expect(ICONES_CATEGORIA).toContain("💸");
  });

  it("adds custom categories without duplicating defaults", () => {
    const categories = mesclarCategorias(CATEGORIAS_PESSOAIS, [
      "Alimentação",
      "Viagem de trabalho",
    ]);

    expect(categories).toHaveLength(CATEGORIAS_PESSOAIS.length + 1);
    expect(categories.at(-1)).toEqual({
      nome: "Viagem de trabalho",
      icone: "📌",
    });
  });

  it("preserves selected icons for custom categories", () => {
    const categories = mesclarCategorias(CATEGORIAS_PESSOAIS, [
      { nome: "Viagem de trabalho", icone: "🧳" },
      { nome: "Viagem de trabalho", icone: "✈️" },
    ]);

    expect(categories.at(-1)).toEqual({
      nome: "Viagem de trabalho",
      icone: "🧳",
    });
    expect(categories.filter(({ nome }) => nome === "Viagem de trabalho")).toHaveLength(1);
  });

  it("applies a user's icon override to a standard category", () => {
    const categories = mesclarCategorias(
      CATEGORIAS_PESSOAIS,
      [],
      [{ nome: "Casa", icone: "🛋️" }],
    );

    expect(categories.find(({ nome }) => nome === "Casa")).toEqual({
      nome: "Casa",
      icone: "🛋️",
    });
  });

  it("keeps the existing category sets for each workflow", () => {
    expect(CATEGORIAS_GRUPO.map(({ nome }) => nome)).toContain("Mercado");
    expect(CATEGORIAS_PESSOAIS.map(({ nome }) => nome)).toContain("Pets");
    expect(CATEGORIAS_RECIBO.map(({ nome }) => nome)).not.toContain("Pets");
  });
});
