import React, { useEffect, useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver, FaceLandmarkerResult } from '@mediapipe/tasks-vision';

export type FaceAction = 'SMILE' | 'POUT' | null;

export function useFaceDetection(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentAction, setCurrentAction] = useState<FaceAction>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const requestRef = useRef<number | null>(null);

  useEffect(() => {
    async function init() {
      try {
        console.log("Initializing FaceLandmarker...");
        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm"
        );
        const faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU"
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 1
        });
        faceLandmarkerRef.current = faceLandmarker;
        setIsLoaded(true);
        console.log("FaceLandmarker initialized successfully.");
      } catch (error) {
        console.error("Failed to initialize FaceLandmarker:", error);
        // Fallback to CPU if GPU fails explicitly
        try {
          console.log("Attempting fallback to CPU delegate...");
          const filesetResolver = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm"
          );
          const faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
            baseOptions: {
              modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
              delegate: "CPU"
            },
            outputFaceBlendshapes: true,
            runningMode: "VIDEO",
            numFaces: 1
          });
          faceLandmarkerRef.current = faceLandmarker;
          setIsLoaded(true);
        } catch (fallbackError) {
          console.error("FaceLandmarker fallback also failed:", fallbackError);
        }
      }
    }
    init();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      faceLandmarkerRef.current?.close();
    };
  }, []);

  const detect = () => {
    if (videoRef.current && videoRef.current.readyState >= 2 && faceLandmarkerRef.current) {
      const startTimeMs = performance.now();
      const results = faceLandmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);
      processResults(results);
    }
    requestRef.current = requestAnimationFrame(detect);
  };

  const processResults = (results: FaceLandmarkerResult) => {
    if (!results.faceBlendshapes || results.faceBlendshapes.length === 0) {
      setCurrentAction(null);
      return;
    }

    const blendshapes = results.faceBlendshapes[0].categories;
    const getScore = (name: string) => blendshapes.find(c => c.categoryName === name)?.score || 0;

    const smileScore = (getScore('mouthSmileLeft') + getScore('mouthSmileRight')) / 2;
    const puckerScore = getScore('mouthPucker');
    
    // Priority: Pout > Smile
    if (puckerScore > 0.35) {
      setCurrentAction('POUT');
    } else if (smileScore > 0.45) {
      setCurrentAction('SMILE');
    } else {
      setCurrentAction(null);
    }
  };

  useEffect(() => {
    if (isLoaded) {
      detect();
    }
  }, [isLoaded]);

  return { isLoaded, currentAction };
}
