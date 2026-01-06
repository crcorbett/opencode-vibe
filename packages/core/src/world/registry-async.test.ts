/**
 * Regression tests for @effect-atom Registry async context behavior.
 * Registry.set() in async contexts doesn't persist without active subscriber.
 * @see https://github.com/joelhooks/opencode-vibe/issues/XXX
 */

import { describe, expect, it } from "vitest"
import { Atom } from "@effect-atom/atom"
import * as Registry from "@effect-atom/atom/Registry"
import { Effect } from "effect"
import {
	Registry as WorldRegistry,
	sessionsAtom,
	instancesAtom,
	worldStateAtom,
} from "./atoms.js"

describe("Registry async context behavior", () => {
	describe("Promise.then() mutations", () => {
		it("WITHOUT subscriber: state set in .then() is lost", async () => {
			const atom = Atom.make(0)
			const registry = Registry.make()

			await Promise.resolve().then(() => {
				registry.set(atom, 42)
			})

			expect(registry.get(atom)).toBe(0)
		})

		it("WITH subscriber: state set in .then() persists", async () => {
			const atom = Atom.make(0)
			const registry = Registry.make()
			registry.subscribe(atom, () => {})

			await Promise.resolve().then(() => {
				registry.set(atom, 42)
			})

			expect(registry.get(atom)).toBe(42)
		})
	})

	describe("Effect.runPromise() mutations", () => {
		it("WITHOUT subscriber: state set in Effect is lost", async () => {
			const atom = Atom.make(new Map<string, number>())
			const registry = Registry.make()

			await Effect.runPromise(
				Effect.sync(() => {
					registry.set(atom, new Map([["key", 123]]))
				})
			)

			expect(registry.get(atom).size).toBe(0)
		})

		it("WITH subscriber: state set in Effect persists", async () => {
			const atom = Atom.make(new Map<string, number>())
			const registry = Registry.make()
			registry.subscribe(atom, () => {})

			await Effect.runPromise(
				Effect.sync(() => {
					registry.set(atom, new Map([["key", 123]]))
				})
			)

			expect(registry.get(atom).size).toBe(1)
			expect(registry.get(atom).get("key")).toBe(123)
		})
	})

	describe("WorldStream getSnapshot pattern", () => {
		it("WITHOUT subscriber: async instancesAtom mutations are lost", async () => {
			const registry = WorldRegistry.make()

			await Promise.resolve().then(() => {
				const instances = new Map([
					[1234, { port: 1234, pid: 1, directory: "/test", status: "connected" as const, baseUrl: "http://localhost:1234", lastSeen: Date.now() }]
				])
				registry.set(instancesAtom, instances)
			})

			expect(registry.get(instancesAtom).size).toBe(0)
		})

		it("WITH subscriber: async instancesAtom mutations persist", async () => {
			const registry = WorldRegistry.make()
			registry.subscribe(instancesAtom, () => {})

			await Promise.resolve().then(() => {
				const instances = new Map([
					[1234, { port: 1234, pid: 1, directory: "/test", status: "connected" as const, baseUrl: "http://localhost:1234", lastSeen: Date.now() }]
				])
				registry.set(instancesAtom, instances)
			})

			expect(registry.get(instancesAtom).size).toBe(1)
		})

		it("WITH subscribers on atoms: derived worldStateAtom reflects async changes", async () => {
			const registry = WorldRegistry.make()
			registry.subscribe(sessionsAtom, () => {})
			registry.subscribe(instancesAtom, () => {})
			registry.subscribe(worldStateAtom, () => {})

			await Promise.resolve().then(() => {
				const sessions = new Map([
					["ses_1", { id: "ses_1", directory: "/test", title: "Test", time: { created: Date.now(), updated: Date.now() } }]
				])
				registry.set(sessionsAtom, sessions as any)

				const instances = new Map([
					[1234, { port: 1234, pid: 1, directory: "/test", status: "connected" as const, baseUrl: "http://localhost:1234", lastSeen: Date.now() }]
				])
				registry.set(instancesAtom, instances)
			})

			const world = registry.get(worldStateAtom)
			expect(world.sessions.length).toBe(1)
			expect(world.instances.length).toBe(1)
		})
	})
})
