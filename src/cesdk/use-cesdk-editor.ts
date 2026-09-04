import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import {
  CESDK_LICENSE_KEY,
  DEFAULT_ASSET_LIBRARY_BASE_URL,
  DEMO_ASSET_LIBRARY_BASE_URL,
  EDITOR_ASSET_BASE_URL,
} from "./config";
import type { CreativeEngineInstance } from "./engine";

type UseCesdkEditorOptions = {
  isOpen: boolean;
  engineRef: RefObject<CreativeEngineInstance | null>;
};

export const useCesdkEditor = ({
  isOpen,
  engineRef,
}: UseCesdkEditorOptions) => {
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const editorInstanceRef = useRef<any>(null);
  const [isEditorLoading, setIsEditorLoading] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    let isCancelled = false;
    const initEditor = async () => {
      if (!editorContainerRef.current) return;
      setIsEditorLoading(true);
      setEditorError(null);
      try {
        const [{ default: CreativeEditorSDK }, archiveUrl] = await Promise.all([
          import("@cesdk/cesdk-js"),
          (async () => {
            const engine = engineRef.current;
            if (!engine) return null;
            try {
              const archive = await engine.scene.saveToArchive();
              return URL.createObjectURL(archive);
            } catch (sceneError) {
              console.warn("Failed to serialize scene for editor", sceneError);
              return null;
            }
          })(),
        ]);
        if (isCancelled || !editorContainerRef.current) return;
        const editor = await CreativeEditorSDK.create(
          editorContainerRef.current,
          {
            license: CESDK_LICENSE_KEY,
            theme: "dark",
            baseURL: EDITOR_ASSET_BASE_URL,
            sceneMode: "Video",
            ui: {
              elements: {
                view: "advanced",
                panels: {
                  inspector: { show: true, position: "right" },
                  settings: { show: true },
                  assetLibrary: { show: true, position: "left" },
                },
                navigation: {
                  action: {
                    export: true,
                  },
                },
              },
            },
          } as any
        );
        editorInstanceRef.current = editor;

        // Configure 10-minute inactivity timeout on editor engine
        try {
          if (typeof (editor.engine as any).unstable_setVideoExportInactivityTimeout === "function") {
            (editor.engine as any).unstable_setVideoExportInactivityTimeout(600000);
          }
          if (typeof (editor.engine as any).unstable_setExportInactivityTimeout === "function") {
            (editor.engine as any).unstable_setExportInactivityTimeout(600000);
          }
        } catch (tErr) {
          console.warn("Could not set editor engine inactivity timeout", tErr);
        }

        // Enable all advanced video editing features
        try {
          editor.feature.enable([
            "ly.img.video",
            "ly.img.video.timeline",
            "ly.img.video.timeline.ruler",
            "ly.img.video.timeline.clips",
            "ly.img.video.timeline.overlays",
            "ly.img.video.timeline.audio",
            "ly.img.video.timeline.controls",
            "ly.img.video.timeline.controls.split",
            "ly.img.video.timeline.controls.playback",
            "ly.img.video.timeline.controls.loop",
            "ly.img.video.timeline.controls.timelineZoom",
            "ly.img.video.caption",
            "ly.img.adjustment",
            "ly.img.filter",
            "ly.img.effect",
            "ly.img.blur",
            "ly.img.transform",
            "ly.img.crop",
            "ly.img.trim",
            "ly.img.text",
            "ly.img.text.styles",
            "ly.img.text.typeface",
            "ly.img.text.fontSize",
            "ly.img.text.fontStyle",
            "ly.img.text.alignment",
            "ly.img.text.advanced",
            "ly.img.opacity",
            "ly.img.blendMode",
            "ly.img.volume",
            "ly.img.playbackSpeed",
            "ly.img.animations",
            "ly.img.transitions",
          ]);
        } catch (featErr) {
          console.warn("Could not enable all advanced features", featErr);
        }

        try {
          await editor.addDefaultAssetSources({
            baseURL: DEFAULT_ASSET_LIBRARY_BASE_URL,
          });
        } catch (assetError) {
          console.warn("Failed to preload editor asset sources", assetError);
        }
        try {
          await editor.addDemoAssetSources({
            baseURL: DEMO_ASSET_LIBRARY_BASE_URL,
            sceneMode: "Video",
          });
        } catch (demoError) {
          console.warn("Failed to add demo assets", demoError);
        }
        if (archiveUrl) {
          try {
            await editor.loadFromArchiveURL(archiveUrl, true);
          } finally {
            URL.revokeObjectURL(archiveUrl);
          }
        } else {
          await editor.createVideoScene();
        }
      } catch (error) {
        if (!isCancelled) {
          setEditorError(
            error instanceof Error
              ? error.message
              : "Failed to initialize CE.SDK editor."
          );
        }
      } finally {
        if (!isCancelled) {
          setIsEditorLoading(false);
        }
      }
    };
    initEditor();
    return () => {
      isCancelled = true;
      if (editorInstanceRef.current) {
        // Sync modified scene back to main engine
        if (engineRef.current) {
          try {
            editorInstanceRef.current.engine.scene
              .saveToArchive()
              .then((updatedArchive: Blob) => {
                const updatedArchiveUrl = URL.createObjectURL(updatedArchive);
                engineRef.current?.scene
                  .loadFromArchiveURL(updatedArchiveUrl)
                  .finally(() => {
                    URL.revokeObjectURL(updatedArchiveUrl);
                  });
              })
              .catch((syncErr: any) => {
                console.warn("Failed to sync scene back on editor close", syncErr);
              });
          } catch (syncErr) {
            console.warn("Failed to trigger scene sync", syncErr);
          }
        }

        try {
          editorInstanceRef.current.dispose();
        } catch (error) {
          console.warn("Failed to dispose editor", error);
        }
        editorInstanceRef.current = null;
      }
      if (editorContainerRef.current) {
        editorContainerRef.current.replaceChildren();
      }
    };
  }, [engineRef, isOpen]);

  return {
    editorContainerRef,
    isEditorLoading,
    editorError,
  };
};
