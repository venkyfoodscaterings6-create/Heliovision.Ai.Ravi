import { beforeEach, describe, expect, it } from "vitest";
import type { AIModel, Provider } from "../lib/types";
import { DEMO_MODEL } from "../lib/seed";
import { useWorkspace } from "./useWorkspace";

const provider: Provider = {
  id: "provider-test",
  name: "Test provider",
  type: "openai",
  baseUrl: "https://api.example.com/v1",
  apiKey: "",
  keyMasked: "Not set",
  headers: [],
  status: "untested",
  enabled: true,
  useProxy: false,
  createdAt: 0,
};

const liveModel: AIModel = {
  id: "model-test",
  providerId: provider.id,
  modelId: "test-model",
  name: "Test model",
  description: "",
  capabilities: { vision: false, reasoning: false, files: false },
  enabled: true,
  sort: 1,
};

beforeEach(() => {
  useWorkspace.setState({
    providers: [provider],
    models: [DEMO_MODEL],
    selectedModelId: DEMO_MODEL.id,
    modelSelectionExplicit: false,
  });
});

describe("live model selection", () => {
  it("selects an existing live model when its provider gets an API key", () => {
    useWorkspace.setState({ models: [DEMO_MODEL, liveModel] });

    useWorkspace.getState().updateProvider(provider.id, { apiKey: "sk-test" });

    expect(useWorkspace.getState().selectedModelId).toBe(liveModel.id);
  });

  it("selects a newly added model when its provider is configured", () => {
    useWorkspace.setState({ providers: [{ ...provider, apiKey: "sk-test" }] });

    useWorkspace.getState().addModel(liveModel);

    expect(useWorkspace.getState().selectedModelId).toBe(liveModel.id);
  });

  it("preserves an explicit live model selection", () => {
    const chosenModel = { ...liveModel, id: "model-chosen", sort: 0 };
    useWorkspace.setState({
      providers: [{ ...provider, apiKey: "sk-test" }],
      models: [DEMO_MODEL, chosenModel],
      selectedModelId: chosenModel.id,
    });

    useWorkspace.getState().addModel({ ...liveModel, id: "model-added", sort: 2 });

    expect(useWorkspace.getState().selectedModelId).toBe(chosenModel.id);
  });

  it("preserves an explicit Demo choice when a live model is added", () => {
    useWorkspace.getState().selectModel(DEMO_MODEL.id);
    useWorkspace.setState({ providers: [{ ...provider, apiKey: "sk-test" }] });

    useWorkspace.getState().addModel(liveModel);

    expect(useWorkspace.getState().selectedModelId).toBe(DEMO_MODEL.id);
  });
});