import { useCallback, useEffect, useRef, useState } from "react";
import {
  CESDK_LICENSE_KEY,
  DEFAULT_ASSET_LIBRARY_BASE_URL,
  ENGINE_ASSET_BASE_URL,
} from "./config";
import { loadCreativeEngine } from "./engine";
import type { CreativeEngineInstance } from "./engine";

type UseCesdkEngineOptions = {
  onBeforeDispose?: (engine: CreativeEngineInstance) => void;
  onAfterDispose?: () => void;
};

// Ensure WebGL contexts created by CE.SDK in browser or OffscreenCanvas request the discrete high-performance GPU (NVIDIA RTX 3050)
if (typeof window !== "undefined" && !(window as any).__gpuPowerPreferencePatched) {
  (window as any).__gpuPowerPreferencePatched = true;
  try {
    const origCanvasGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: any[]
    ) {
      const [contextType, contextAttributes] = args;
      if (contextType === "webgl" || contextType === "webgl2") {
        args[1] = {
          powerPreference: "high-performance",
          ...contextAttributes,
        };
      }
      return (origCanvasGetContext as any).apply(this, args);
    } as any;

    if (typeof OffscreenCanvas !== "undefined") {
      const origOffscreenGetContext = OffscreenCanvas.prototype.getContext;
      OffscreenCanvas.prototype.getContext = function (
        this: OffscreenCanvas,
        ...args: any[]
      ) {
        const [contextType, contextAttributes] = args;
        if (contextType === "webgl" || contextType === "webgl2") {
          args[1] = {
            powerPreference: "high-performance",
            ...contextAttributes,
          };
        }
        return (origOffscreenGetContext as any).apply(this, args);
      } as any;
    }
  } catch (gpuPatchErr) {
    console.warn("Could not patch WebGL high-performance preference:", gpuPatchErr);
  }
}

export const useCesdkEngine = (options: UseCesdkEngineOptions = {}) => {
  const { onBeforeDispose, onAfterDispose } = options;
  const engineRef = useRef<CreativeEngineInstance | null>(null);
  const pageRef = useRef<number | null>(null);
  const lastContainerRef = useRef<HTMLDivElement | null>(null);
  const [engineCanvasContainer, setEngineCanvasContainer] =
    useState<HTMLDivElement | null>(null);
  const engineCanvasContainerRef = useCallback((node: HTMLDivElement | null) => {
    lastContainerRef.current = node;
    setEngineCanvasContainer(node);
  }, []);
  const [isEngineReady, setIsEngineReady] = useState(false);
  const [engineInitError, setEngineInitError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    const initEngine = async () => {
      if (engineRef.current) return;
      try {
        setIsEngineReady(false);
        setEngineInitError(null);
        const CreativeEngine = await loadCreativeEngine();
        const engine = await CreativeEngine.init({
          license: CESDK_LICENSE_KEY,
          baseURL: ENGINE_ASSET_BASE_URL,
          userId: "video-clipper",
          featureFlags: {
            optimizedLocalUploads: true,
          },
        });

        // Increase video export inactivity timeout to 10 minutes (600,000ms) to prevent timeout failures on long/4K clips
        try {
          if (typeof (engine as any).unstable_setVideoExportInactivityTimeout === "function") {
            (engine as any).unstable_setVideoExportInactivityTimeout(600000);
          }
          if (typeof (engine as any).unstable_setExportInactivityTimeout === "function") {
            (engine as any).unstable_setExportInactivityTimeout(600000);
          }
        } catch (timeoutErr) {
          console.warn("Could not set export inactivity timeout", timeoutErr);
        }

        try {
          await engine.addDefaultAssetSources({
            baseURL: DEFAULT_ASSET_LIBRARY_BASE_URL,
          });
        } catch (assetError) {
          console.warn("Failed to load default asset sources", assetError);
        }

        if (isCancelled) {
          engine.dispose();
          return;
        }

        const scene = await engine.scene.createVideo();
        const page = engine.block.create("page");
        engine.block.appendChild(scene, page);
        engine.editor.setSettingBool("page/title/show", false);
        engine.editor.setSettingBool("mouse/enableScroll", false);
        engine.editor.setSettingBool("mouse/enableZoom", false);
        engine.editor.setSettingBool("page/allowMoveInteraction", false);
        engine.editor.setSettingBool("page/allowResizeInteraction", false);
        try {
          engine.editor.setSettingBool("page/dimOutOfPageAreas", true);
        } catch (error) {
          console.warn("Failed to enable out-of-page dimming", error);
        }
        try {
          await engine.scene.zoomToBlock(page, { padding: 0 });
        } catch (zoomError) {
          console.warn("Failed to zoom to initial page", zoomError);
        }

        engineRef.current = engine;
        pageRef.current = page;
        if (typeof window !== "undefined") {
          (window as any).__cesdkEngine = engine;
        }

        // Clean OPFS directory on initialization
        try {
          const directory = await navigator.storage.getDirectory();
          const entries = (directory as any).values();
          for await (const entry of entries) {
            try {
              await directory.removeEntry(entry.name);
            } catch (removeError) {
              console.warn(`Failed to remove OPFS entry: ${entry.name}`, removeError);
            }
          }
        } catch (opfsError) {
          console.warn("Failed to clean OPFS directory", opfsError);
        }

        setIsEngineReady(true);
      } catch (error) {
        if (isCancelled) return;
        console.error("Failed to initialize CreativeEngine", error);
        setEngineInitError(
          error instanceof Error
            ? error.message
            : "Failed to initialize CreativeEngine"
        );
        setIsEngineReady(false);
      }
    };

    initEngine();

    return () => {
      isCancelled = true;
      const engineInstance = engineRef.current;
      if (engineInstance) {
        onBeforeDispose?.(engineInstance);
        engineInstance.dispose();
        engineRef.current = null;
      }
      pageRef.current = null;
      const container = lastContainerRef.current;
      container?.replaceChildren();
      setIsEngineReady(false);
      onAfterDispose?.();
    };
  }, [onAfterDispose, onBeforeDispose]);

  useEffect(() => {
    if (!isEngineReady) return;
    const engine = engineRef.current;
    if (!engine || !engine.element || !engineCanvasContainer) return;
    engine.element.style.width = "100%";
    engine.element.style.height = "100%";
    engine.element.style.display = "block";
    engine.element.style.margin = "0";
    engine.element.style.padding = "0";
    engineCanvasContainer.replaceChildren(engine.element);
    const page = pageRef.current;
    if (page && engine.block.isValid(page)) {
      engine.scene.zoomToBlock(page, { padding: 0 }).catch((error: unknown) => {
        console.warn("Failed to zoom after canvas attach", error);
      });
    }
  }, [engineCanvasContainer, isEngineReady]);

  return {
    engineRef,
    pageRef,
    engineCanvasContainerRef,
    isEngineReady,
    engineInitError,
  };
};
