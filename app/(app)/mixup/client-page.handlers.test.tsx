import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, it, vi } from "vitest";
import type { Mixup } from "@/lib/types";

type StateEntry = {
	value: unknown;
	setter?: ReturnType<typeof vi.fn>;
};

type CapturedListProps = {
	onDeleteMixup: (mixupId: string) => Promise<void>;
	onEditMixup: (mixup: Mixup) => Promise<void>;
};

type CapturedBuilderProps = {
	onSave: (data: {
		id?: string;
		name: string;
		layout_id: string;
		assignments: Record<string, string>;
	}) => Promise<void>;
};

const mixupState = vi.hoisted(() => ({
	routerRefresh: vi.fn(),
	listProps: null as CapturedListProps | null,
	builderProps: null as CapturedBuilderProps | null,
}));

const toastState = vi.hoisted(() => ({
	success: vi.fn(),
	error: vi.fn(),
}));

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		refresh: mixupState.routerRefresh,
	}),
}));

vi.mock("sonner", () => ({
	toast: toastState,
}));

vi.mock("@/app/actions/mixup", () => ({
	deleteMixup: vi.fn(),
	fetchMixupWithSlots: vi.fn(),
	saveMixupWithSlots: vi.fn(),
}));

vi.mock("@/components/common/page-template", () => ({
	PageTemplate: ({ children }: { children?: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

vi.mock("@/components/mixup/mixup-builder", () => ({
	MixupBuilder: (props: CapturedBuilderProps) => {
		mixupState.builderProps = props;
		return <div>mixup-builder</div>;
	},
}));

vi.mock("@/components/mixup/mixup-list", () => ({
	MixupList: (props: CapturedListProps) => {
		mixupState.listProps = props;
		return <div>mixup-list</div>;
	},
}));

vi.mock("@/components/ui/button", () => ({
	Button: ({ children }: { children: React.ReactNode }) => (
		<button type="button">{children}</button>
	),
}));

vi.mock("@/lib/mixup/constants", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/mixup/constants")>();
	return {
		...actual,
		slotsToAssignments: vi.fn(() => ({
			"top-left": "recipe-1",
		})),
	};
});

async function loadClientPage(stateEntries: StateEntry[]) {
	vi.resetModules();
	const entries = stateEntries;
	let callIndex = 0;

	vi.doMock("react", async (importOriginal) => {
		const actual = await importOriginal<typeof import("react")>();
		return {
			...actual,
			useState: (initial: unknown) => {
				const resolvedInitial =
					typeof initial === "function"
						? (initial as () => unknown)()
						: initial;
				const entry = entries[callIndex++];
				if (!entry) {
					return [resolvedInitial, vi.fn()] as const;
				}
				return [entry.value, entry.setter ?? vi.fn()] as const;
			},
		};
	});

	return (await import("./client-page.tsx")).default;
}

function buildMixup(overrides: Partial<Mixup> = {}): Mixup {
	return {
		id: "mixup-1",
		name: "Split",
		layout_id: "quarters",
		created_at: null,
		updated_at: null,
		...overrides,
	};
}

afterEach(() => {
	vi.clearAllMocks();
	mixupState.routerRefresh.mockClear();
	mixupState.listProps = null;
	mixupState.builderProps = null;
	toastState.success.mockClear();
	toastState.error.mockClear();
	vi.unstubAllGlobals();
});

describe("Mixup client page handlers", () => {
	it("loads a mixup into the editor with fetched slot assignments", async () => {
		const setShowEditor = vi.fn();
		const setEditingData = vi.fn();
		const setIsLoading = vi.fn();
		const fetchMixupWithSlots = vi.mocked(
			(await import("@/app/actions/mixup")).fetchMixupWithSlots,
		);
		fetchMixupWithSlots.mockResolvedValue({
			mixup: buildMixup(),
			slots: [],
		});

		const MixupClientPage = await loadClientPage([
			{ value: [buildMixup()] },
			{ value: false, setter: setShowEditor },
			{ value: undefined, setter: setEditingData },
			{ value: false, setter: setIsLoading },
		]);

		renderToStaticMarkup(
			<MixupClientPage
				initialMixups={[buildMixup()]}
				recipes={[]}
				screens={[]}
			/>,
		);
		await mixupState.listProps?.onEditMixup(buildMixup());

		assert.deepEqual(fetchMixupWithSlots.mock.calls[0], ["mixup-1"]);
		assert.deepEqual(setEditingData.mock.calls[0]?.[0], {
			id: "mixup-1",
			name: "Split",
			layout_id: "quarters",
			assignments: {
				"top-left": "recipe-1",
			},
		});
		assert.equal(setShowEditor.mock.calls[0]?.[0], true);
		assert.deepEqual(
			setIsLoading.mock.calls.map((call) => call[0]),
			[true, false],
		);
	});

	it("saves a mixup and refreshes the route on success", async () => {
		const setShowEditor = vi.fn();
		const setEditingData = vi.fn();
		const setIsLoading = vi.fn();
		const saveMixupWithSlots = vi.mocked(
			(await import("@/app/actions/mixup")).saveMixupWithSlots,
		);
		saveMixupWithSlots.mockResolvedValue({ success: true, mixupId: "mixup-1" });

		const MixupClientPage = await loadClientPage([
			{ value: [buildMixup()] },
			{ value: true, setter: setShowEditor },
			{
				value: {
					id: "mixup-1",
					name: "Split",
					layout_id: "quarters",
					assignments: {},
				},
				setter: setEditingData,
			},
			{ value: false, setter: setIsLoading },
		]);

		renderToStaticMarkup(
			<MixupClientPage
				initialMixups={[buildMixup()]}
				recipes={[]}
				screens={[]}
			/>,
		);
		await mixupState.builderProps?.onSave({
			id: "mixup-1",
			name: "Split",
			layout_id: "quarters",
			assignments: {},
		});

		assert.equal(
			toastState.success.mock.calls[0]?.[0],
			"Mixup updated successfully!",
		);
		assert.equal(setShowEditor.mock.calls[0]?.[0], false);
		assert.equal(setEditingData.mock.calls[0]?.[0], undefined);
		assert.equal(mixupState.routerRefresh.mock.calls.length, 1);
		assert.deepEqual(
			setIsLoading.mock.calls.map((call) => call[0]),
			[true, false],
		);
	});

	it("deletes a mixup after confirmation and removes it from state", async () => {
		const setMixups = vi.fn();
		const setIsLoading = vi.fn();
		const deleteMixup = vi.mocked(
			(await import("@/app/actions/mixup")).deleteMixup,
		);
		deleteMixup.mockResolvedValue({ success: true });
		vi.stubGlobal(
			"confirm",
			vi.fn(() => true),
		);

		const MixupClientPage = await loadClientPage([
			{ value: [buildMixup()], setter: setMixups },
			{ value: false },
			{ value: undefined },
			{ value: false, setter: setIsLoading },
		]);

		renderToStaticMarkup(
			<MixupClientPage
				initialMixups={[buildMixup()]}
				recipes={[]}
				screens={[]}
			/>,
		);
		await mixupState.listProps?.onDeleteMixup("mixup-1");

		assert.deepEqual(deleteMixup.mock.calls[0], ["mixup-1"]);
		assert.equal(
			toastState.success.mock.calls[0]?.[0],
			"Mixup deleted successfully!",
		);
		const updater = setMixups.mock.calls[0]?.[0] as (
			mixups: Mixup[],
		) => Mixup[];
		assert.deepEqual(updater([buildMixup(), buildMixup({ id: "mixup-2" })]), [
			buildMixup({ id: "mixup-2" }),
		]);
		assert.deepEqual(
			setIsLoading.mock.calls.map((call) => call[0]),
			[true, false],
		);
	});

	it("shows an error when saving a mixup fails without refreshing the route", async () => {
		const setShowEditor = vi.fn();
		const setEditingData = vi.fn();
		const setIsLoading = vi.fn();
		const saveMixupWithSlots = vi.mocked(
			(await import("@/app/actions/mixup")).saveMixupWithSlots,
		);
		saveMixupWithSlots.mockResolvedValue({
			success: false,
			error: "layout invalid",
		});

		const MixupClientPage = await loadClientPage([
			{ value: [buildMixup()] },
			{ value: true, setter: setShowEditor },
			{
				value: {
					id: "mixup-1",
					name: "Split",
					layout_id: "quarters",
					assignments: {},
				},
				setter: setEditingData,
			},
			{ value: false, setter: setIsLoading },
		]);

		renderToStaticMarkup(
			<MixupClientPage
				initialMixups={[buildMixup()]}
				recipes={[]}
				screens={[]}
			/>,
		);
		await mixupState.builderProps?.onSave({
			id: "mixup-1",
			name: "Split",
			layout_id: "quarters",
			assignments: {},
		});

		assert.equal(toastState.error.mock.calls[0]?.[0], "layout invalid");
		assert.equal(setShowEditor.mock.calls.length, 0);
		assert.equal(setEditingData.mock.calls.length, 0);
		assert.equal(mixupState.routerRefresh.mock.calls.length, 0);
		assert.deepEqual(
			setIsLoading.mock.calls.map((call) => call[0]),
			[true, false],
		);
	});

	it("skips deletion when the confirmation dialog is cancelled", async () => {
		const setIsLoading = vi.fn();
		const deleteMixup = vi.mocked(
			(await import("@/app/actions/mixup")).deleteMixup,
		);
		vi.stubGlobal(
			"confirm",
			vi.fn(() => false),
		);

		const MixupClientPage = await loadClientPage([
			{ value: [buildMixup()] },
			{ value: false },
			{ value: undefined },
			{ value: false, setter: setIsLoading },
		]);

		renderToStaticMarkup(
			<MixupClientPage
				initialMixups={[buildMixup()]}
				recipes={[]}
				screens={[]}
			/>,
		);
		await mixupState.listProps?.onDeleteMixup("mixup-1");

		assert.equal(deleteMixup.mock.calls.length, 0);
		assert.equal(setIsLoading.mock.calls.length, 0);
		assert.equal(toastState.success.mock.calls.length, 0);
	});
});
