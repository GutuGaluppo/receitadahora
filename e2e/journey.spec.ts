import { expect, test, type Page } from "@playwright/test";

async function onboard(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Começar" }).click();
  await expect(page.getByRole("heading", { name: "Como você costuma comer?" })).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "O que importa mais para você?" })).toBeVisible();
  await page.getByRole("checkbox", { name: "Mais proteína" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("radio", { name: "20 minutos" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Posso considerar o clima da sua cidade?" })).toBeVisible();
  await page.getByRole("button", { name: "Agora não" }).click();
}

test.beforeEach(async ({ context }) => {
  await context.route("**/open-meteo.com/**", (r) => r.abort()); // sem rede externa: clima é opcional
});

test("onboarding → home com sugestão, sem tela intermediária", async ({ page }) => {
  await onboard(page);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ver receita" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Outra sugestão" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Abrir biblioteca" })).toBeVisible();
  await expect(page.locator("nav, aside")).toHaveCount(0);
});

test("abre receita sem recarregar a página; salva; biblioteca reflete", async ({ page }) => {
  await onboard(page);
  const url = page.url();
  const title = await page.getByRole("heading", { level: 1 }).innerText();
  await page.getByRole("button", { name: "Ver receita" }).click();
  await expect(page.getByRole("heading", { name: "Ingredientes" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Modo de preparo" })).toBeVisible();
  expect(page.url()).toBe(url);

  await page.getByRole("button", { name: "Salvar receita" }).click();
  await expect(page.getByRole("button", { name: "Salva", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Abrir biblioteca" }).click();
  const drawer = page.getByRole("dialog", { name: "Biblioteca" });
  await expect(drawer.getByText("Receitas salvas (1)")).toBeVisible();
  await expect(drawer.getByText(title).first()).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(page.getByRole("heading", { name: "Ingredientes" })).toBeVisible(); // estado preservado
});

test("outra sugestão pergunta a intenção e troca de receita", async ({ page }) => {
  await onboard(page);
  const before = await page.getByRole("heading", { level: 1 }).innerText();
  await page.getByRole("button", { name: "Outra sugestão" }).click();
  await expect(page.getByText("O que você prefere agora?")).toBeVisible();
  await page.getByRole("button", { name: /Mais rápido/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(before);
});

test("feedback 'Não é pra mim' pede o motivo e passa para a próxima", async ({ page }) => {
  await onboard(page);
  const before = await page.getByRole("heading", { level: 1 }).innerText();
  await page.getByRole("button", { name: "Ver receita" }).click();
  await page.getByRole("button", { name: "Não é pra mim" }).click();
  await page.getByRole("button", { name: "Muito pesada" }).click();
  await expect(page.getByRole("button", { name: "Ver receita" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(before);
});

test("preferências do Meu Gosto persistem após recarregar", async ({ page }) => {
  await onboard(page);
  await page.getByRole("button", { name: "Abrir biblioteca" }).click();
  await page.getByRole("button", { name: "Meu gosto" }).click();
  await page.getByRole("button", { name: /Alimentação/ }).click();
  await page.getByRole("checkbox", { name: "Vegano" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Ver receita" })).toBeVisible();
  await page.getByRole("button", { name: "Abrir biblioteca" }).click();
  await page.getByRole("button", { name: "Meu gosto" }).click();
  await expect(page.getByRole("button", { name: /Alimentação/ })).toContainText("vegano");
});
