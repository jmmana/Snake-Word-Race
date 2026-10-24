import { test, expect } from "@playwright/test";
import fs from "node:fs";
const questions = JSON.parse(
  fs.readFileSync("src/data/questions.json", "utf8"),
);
test("inicio, seis niveles, cuatro modos y ventanas con el mismo estilo", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".race-hero")).toBeVisible();
  await page.screenshot({
    path: "test-results/home-desktop.png",
    fullPage: true,
  });
  await expect(page.locator(".level-picker button")).toHaveCount(6);
  await expect(page.locator(".mode-option")).toHaveCount(4);
  for (const [name, label] of [
    ["Cómo jugar", "Cómo jugar"],
    ["Récords", "Récords"],
    ["Estadísticas", "Estadísticas"],
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: label, exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Activar menú oscuro" }).click();
  await page.reload();
  await expect(page.locator(".adventure-topbar")).toHaveClass(/dark/);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
test("carrera local: 30 casillas, respuesta real y ficha en movimiento", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.getByRole("button", { name: "Empezar aventura" }).click();
  await expect(page.locator("[data-cell]")).toHaveCount(30);
  expect(
    await page
      .locator("[data-cell]")
      .evaluateAll(
        (nodes) => new Set(nodes.map((n) => n.getAttribute("data-cell"))).size,
      ),
  ).toBe(30);
  await expect(page.locator(".race-pawn.you")).toHaveAttribute(
    "data-position",
    "0",
  );
  await page.screenshot({
    path: "test-results/match-desktop.png",
    fullPage: true,
  });
  for (const [width, height] of [
    [1440, 900],
    [1366, 768],
    [1920, 1080],
    [1024, 768],
  ]) {
    await page.setViewportSize({ width, height });
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight),
      `La carrera cabe en ${width}x${height}`,
    ).toBeLessThanOrEqual(height + 1);
    await expect(
      page.getByRole("region", { name: "Marcador de la carrera" }),
    ).toBeInViewport();
    expect(
      await page
        .locator(".adventure-board")
        .evaluate((e) => e.getBoundingClientRect().bottom),
    ).toBeLessThanOrEqual(height);
    expect(
      await page
        .locator(".race-scoreboard")
        .evaluate((e) => e.getBoundingClientRect().top),
    ).toBeLessThan(
      await page
        .locator(".question-card")
        .evaluate((e) => e.getBoundingClientRect().top),
    );
    if (width === 1366)
      await page.screenshot({
        path: "test-results/match-laptop.png",
        fullPage: true,
      });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const clue = await page.locator(".question-card p").first().innerText();
  const q = questions.find((x: any) => x.clueEn === clue);
  expect(q).toBeTruthy();
  if (q.type === "multiple_choice" || q.type === "gap_fill") {
    const option = q.options.find((o: any) => o.id === q.correctOptionId);
    await page
      .locator(".question-card")
      .getByRole("button")
      .filter({ hasText: option.text })
      .first()
      .click();
  } else if (q.type === "text_input") {
    await page.locator(".question-card input").fill(q.answer);
    await page.locator(".question-card input").press("Enter");
  } else {
    for (const c of q.answer.replace(/\s/g, "")) {
      await page
        .locator(".question-card button:not(:disabled)")
        .filter({
          hasText: new RegExp(
            "^" + c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$",
          ),
        })
        .first()
        .click();
    }
    await page
      .locator(".question-card")
      .getByRole("button", { name: "Enviar", exact: false })
      .click();
  }
  await page.clock.fastForward(11000);
  await expect
    .poll(() => page.locator(".race-pawn.you").getAttribute("data-position"))
    .not.toBe("0");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  expect(
    await page
      .locator(".race-challenge")
      .evaluate((e) => e.getBoundingClientRect().top),
  ).toBeLessThan(
    await page
      .locator(".adventure-board")
      .evaluate((e) => e.getBoundingClientRect().top),
  );
  await page.screenshot({
    path: "test-results/match-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("sala de dos jugadores: crear, unirse y arrancar partida", async ({
  browser,
}) => {
  const a = await browser.newContext(),
    b = await browser.newContext();
  const host = await a.newPage(),
    guest = await b.newPage();
  try {
    for (const p of [host, guest]) await p.goto("http://127.0.0.1:3000/");
    await host.locator("#player-name").fill("Anfitrión");
    await host.getByRole("button", { name: /Con un amigo/ }).click();
    await host.getByRole("button", { name: "Crear sala multijugador" }).click();
    await expect(host.locator(".view-lobby")).toBeVisible();
    const code = (
      await host.locator(".view-lobby .font-mono").first().innerText()
    ).trim();
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
    await guest.locator("#player-name").fill("Invitado");
    await guest.getByRole("button", { name: /Con un amigo/ }).click();
    await guest.getByRole("textbox", { name: "Código de sala" }).fill(code);
    await guest.getByRole("button", { name: "Unirme", exact: true }).click();
    await expect(guest.locator(".view-lobby")).toBeVisible();
    await host.getByRole("button", { name: "Marcar como Listo" }).click();
    await guest.getByRole("button", { name: "Marcar como Listo" }).click();
    await expect(host.locator(".adventure-board")).toBeVisible();
    await expect(guest.locator(".adventure-board")).toBeVisible();
    await expect(host.locator(".race-pawn")).toHaveCount(2);
  } finally {
    await a.close();
    await b.close();
  }
});
