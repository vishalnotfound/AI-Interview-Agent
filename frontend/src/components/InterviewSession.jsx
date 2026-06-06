import { useState, useEffect, useRef, useCallback } from 'react';
import { submitAnswer } from '../api';
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

const TOTAL_QUESTIONS = 6;
const MAX_RECORD_SECONDS = 120;
const SILENCE_TIMEOUT_MS = 8000; // auto-submit after 8s of silence
const MAX_WARNINGS = 2;

export default function InterviewSession({ sessionId, firstQuestion, onComplete, onCancel }) {
  const [currentQuestion, setCurrentQuestion] = useState(firstQuestion);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [status, setStatus] = useState('speaking'); // speaking | recording | processing | idle
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(MAX_RECORD_SECONDS);
  const [speechSupported, setSpeechSupported] = useState(true);

  // ─── Proctoring state ───
  const [warningCount, setWarningCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  const warningCountRef = useRef(0);

  // ─── Refs for mutable state (avoids stale closures) ───
  const recognitionRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const silenceTimeoutRef = useRef(null);
  const transcriptRef = useRef('');
  const isSubmittingRef = useRef(false);
  const shouldListenRef = useRef(false);

  // ─── Proctoring / Video Refs ───
  const videoRef = useRef(null);
  const faceDetectorRef = useRef(null);
  const streamRef = useRef(null);
  const detectionIntervalRef = useRef(null);
  const faceIssueTimerRef = useRef(null);

  // These refs always hold the LATEST values so any callback can read them
  const currentQuestionRef = useRef(firstQuestion);
  const previousQuestionsRef = useRef([]);
  const previousAnswersRef = useRef([]);
  const questionNumberRef = useRef(1);

  // ─── Check browser support ───
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) setSpeechSupported(false);
  }, []);

  // ─── Cancel TTS on page refresh/close ───
  useEffect(() => {
    const handleUnload = () => {
      window.speechSynthesis?.cancel();
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  // ─── Proctoring: handle a violation (tab switch or fullscreen exit) ───
  const handleViolation = useCallback((reason) => {
    const newCount = warningCountRef.current + 1;
    warningCountRef.current = newCount;
    setWarningCount(newCount);

    if (newCount > MAX_WARNINGS) {
      // Out of warnings — cancel interview
      window.speechSynthesis?.cancel();
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      onCancel?.();
      return;
    }

    setWarningMessage(
      newCount === 1
        ? `⚠️ ${reason}\n\nThis is your first warning. You have 1 warning left.\n\n⚠️ Note: One more violation and your interview will be cancelled. You will have to start over.`
        : `🚨 ${reason}\n\nThis is your FINAL warning!\n\n🚨 The next violation WILL cancel your interview and you will be redirected to the home page.`
    );
    setShowWarning(true);
  }, [onCancel]);

  // ─── Proctoring: Initialize MediaPipe & Camera & Fullscreen ───
  useEffect(() => {
    let active = true;

    const initProctoring = async () => {
      try {
        // 1. Request camera first (prevents fullscreen exit on permission popup)
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
        if (!active) return;
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // 2. Request fullscreen AFTER camera permissions
        try {
          if (!document.fullscreenElement) {
            await document.documentElement.requestFullscreen();
          }
        } catch (err) {
          console.warn('Fullscreen request denied:', err);
        }

        // 3. Initialize MediaPipe FaceDetector
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        if (!active) return;

        const detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
            delegate: "GPU"
          },
          runningMode: "VIDEO"
        });
        if (!active) return;

        faceDetectorRef.current = detector;

        // 4. Start detection loop (2 FPS)
        detectionIntervalRef.current = setInterval(() => {
          if (!videoRef.current || videoRef.current.readyState < 2 || !faceDetectorRef.current) return;
          
          // Don't trigger violations if a warning is already showing
          if (showWarning) return;

          const startTimeMs = performance.now();
          const results = faceDetectorRef.current.detectForVideo(videoRef.current, startTimeMs);
          const numFaces = results.detections.length;
          
          if (numFaces !== 1) {
             if (!faceIssueTimerRef.current) {
                faceIssueTimerRef.current = setTimeout(() => {
                   if (numFaces === 0) {
                       handleViolation('No face detected. Please ensure you are looking at the screen.');
                   } else if (numFaces > 1) {
                       handleViolation('Multiple faces detected. You must take the interview alone.');
                   }
                   faceIssueTimerRef.current = null;
                }, 4000); // Trigger after 4 seconds of continuous issue
             }
          } else {
             if (faceIssueTimerRef.current) {
                clearTimeout(faceIssueTimerRef.current);
                faceIssueTimerRef.current = null;
             }
          }
        }, 500);

      } catch (error) {
        console.error("Camera or MediaPipe init failed:", error);
      }
    };

    initProctoring();

    return () => {
      active = false;
      if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
      if (faceIssueTimerRef.current) clearTimeout(faceIssueTimerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      if (faceDetectorRef.current) {
         faceDetectorRef.current.close();
      }
    };
  }, [handleViolation, showWarning]);

  // ─── Proctoring: detect fullscreen exit ───
  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        handleViolation('Fullscreen exit detected');
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [handleViolation]);

  // ─── Proctoring: detect tab switch / window blur ───
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) {
        handleViolation('Tab switching detected');
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [handleViolation]);

  // ─── Dismiss warning and re-enter fullscreen ───
  const dismissWarning = async () => {
    setShowWarning(false);
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch (_) { /* ignore */ }
  };

  // ─── Speak text via TTS ───
  const speakQuestion = useCallback((text) => {
    return new Promise((resolve) => {
      if (!window.speechSynthesis) { resolve(); return; }
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1;
      utterance.lang = 'en-US';

      const voices = window.speechSynthesis.getVoices();
      // Prefer the most natural-sounding English voices (ordered by quality)
      const preferred = voices.find(v => v.name.includes('Microsoft Aria Online'))   // Windows Neural
        || voices.find(v => v.name.includes('Microsoft Jenny Online'))               // Windows Neural
        || voices.find(v => v.name.includes('Microsoft Guy Online'))                 // Windows Neural
        || voices.find(v => /Microsoft.*Online/i.test(v.name) && v.lang.startsWith('en'))  // Any Windows Neural
        || voices.find(v => v.name.includes('Google US English'))                    // Chrome
        || voices.find(v => v.name.includes('Google UK English Female'))             // Chrome
        || voices.find(v => v.lang.startsWith('en') && v.name.includes('Google'))
        || voices.find(v => v.lang.startsWith('en-US') && !v.localService)           // Any cloud voice
        || voices.find(v => v.lang.startsWith('en'));
      if (preferred) utterance.voice = preferred;

      let resolved = false;
      const safeResolve = () => {
        if (resolved) return;
        resolved = true;
        setIsSpeaking(false);
        resolve();
      };

      utterance.onstart = () => {
        setIsSpeaking(true);
        setStatus('speaking');
      };

      utterance.onend = () => {
        // Poll briefly to ensure audio has truly stopped
        const checkDone = setInterval(() => {
          if (!window.speechSynthesis.speaking) {
            clearInterval(checkDone);
            safeResolve();
          }
        }, 100);
        // Safety fallback — resolve after 500ms regardless
        setTimeout(() => { clearInterval(checkDone); safeResolve(); }, 500);
      };

      utterance.onerror = () => { safeResolve(); };

      window.speechSynthesis.speak(utterance);

      // Failsafe: Chrome sometimes drops onend entirely for long utterances.
      // Poll every 250ms to detect when speaking actually stops.
      const failsafe = setInterval(() => {
        if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
          clearInterval(failsafe);
          // Give onend a moment to fire naturally
          setTimeout(() => safeResolve(), 300);
        }
      }, 250);
    });
  }, []);

  // ─── Cleanup all recording resources ───
  const cleanupRecording = useCallback(() => {
    shouldListenRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (_) { /* ignore */ }
      recognitionRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    setIsRecording(false);
  }, []);

  // ─── Submit answer to backend ───
  const doSubmit = useCallback(async () => {
    if (isSubmittingRef.current) return;

    const answer = transcriptRef.current.trim();
    if (!answer) {
      // No speech detected — restart listening after a short delay
      setError('No speech detected. Listening again…');
      cleanupRecording();
      setTimeout(() => {
        setError('');
        startListeningFn();
      }, 2000);
      return;
    }

    isSubmittingRef.current = true;
    cleanupRecording();
    setStatus('processing');
    setError('');

    // Read latest values from refs
    const q = currentQuestionRef.current;
    const prevQ = [...previousQuestionsRef.current];
    const prevA = [...previousAnswersRef.current];

    try {
      const data = await submitAnswer({
        session_id: sessionId,
        current_question: q,
        current_answer: answer,
        previous_questions: prevQ,
        previous_answers: prevA,
      });

      if (data.final_report) {
        await speakQuestion("Great job! Your interview is complete. Here are your results.");
        onComplete(data.final_report);
        isSubmittingRef.current = false;
        return;
      }

      // Update refs FIRST, then state (so refs are ready before next render)
      const nextQ = data.next_question;
      const newQNum = data.question_count + 1;

      previousQuestionsRef.current = [...prevQ, q];
      previousAnswersRef.current = [...prevA, answer];
      currentQuestionRef.current = nextQ;
      questionNumberRef.current = newQNum;

      setCurrentQuestion(nextQ);
      setQuestionNumber(newQNum);
      setTranscript('');
      transcriptRef.current = '';
      isSubmittingRef.current = false;

      // Speak the next question, then start listening
      setStatus('speaking');
      await speakQuestion(nextQ);
      startListeningFn();
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setStatus('idle');
      isSubmittingRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, onComplete, cleanupRecording, speakQuestion]);

  // ─── Keep a ref to doSubmit so callbacks can call the latest version ───
  const doSubmitRef = useRef(doSubmit);
  useEffect(() => { doSubmitRef.current = doSubmit; }, [doSubmit]);

  // ─── Wait until TTS is truly finished ───
  function waitForSpeechEnd() {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (!window.speechSynthesis?.speaking && !window.speechSynthesis?.pending) {
          clearInterval(check);
          resolve();
        }
      }, 100);
      // Safety timeout — don't wait forever
      setTimeout(() => { clearInterval(check); resolve(); }, 10000);
    });
  }

  // ─── Start speech recognition ───
  async function startListeningFn() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition not supported. Please use Chrome.');
      return;
    }

    // Wait for any ongoing TTS to finish before switching to listening mode
    if (window.speechSynthesis?.speaking || window.speechSynthesis?.pending) {
      setStatus('speaking');
      await waitForSpeechEnd();
    }

    // Clean up any previous recording session first
    cleanupRecording();

    // Reset state for the new recording
    setTranscript('');
    transcriptRef.current = '';
    setError('');
    setTimer(MAX_RECORD_SECONDS);
    isSubmittingRef.current = false;
    shouldListenRef.current = true;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';

    let finalTranscript = '';

    // ── Silence timer: auto-submit after SILENCE_TIMEOUT_MS of no speech ──
    const resetSilenceTimer = () => {
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = setTimeout(() => {
        // Don't auto-submit while the AI is still speaking
        if (window.speechSynthesis?.speaking) {
          resetSilenceTimer();
          return;
        }
        if (!isSubmittingRef.current && shouldListenRef.current) {
          doSubmitRef.current?.();
        }
      }, SILENCE_TIMEOUT_MS);
    };

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript + ' ';
        } else {
          interim += result[0].transcript;
        }
      }
      const full = finalTranscript + interim;
      transcriptRef.current = full;
      setTranscript(full);
      resetSilenceTimer();
    };

    recognition.onerror = (event) => {
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        setError(`Speech error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      // Chrome can stop recognition unexpectedly — restart if we should still be listening
      if (shouldListenRef.current && !isSubmittingRef.current) {
        try {
          const fresh = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
          fresh.continuous = true;
          fresh.interimResults = true;
          fresh.lang = 'en-IN';
          fresh.onresult = recognition.onresult;
          fresh.onerror = recognition.onerror;
          fresh.onend = recognition.onend;
          recognitionRef.current = fresh;
          fresh.start();
        } catch (_) { /* ignore restart errors */ }
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    setStatus('recording');
    resetSilenceTimer();

    // Countdown timer
    timerIntervalRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          // Time's up — submit
          if (!isSubmittingRef.current) {
            doSubmitRef.current?.();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  // ─── Speak the first question on mount, then start listening ───
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      if (!window.speechSynthesis) return;

      // 1. Wait for voices to load (some browsers load them async)
      let voices = window.speechSynthesis.getVoices();
      if (!voices.length) {
        await new Promise((resolve) => {
          const onVoices = () => {
            window.speechSynthesis.removeEventListener('voiceschanged', onVoices);
            resolve();
          };
          window.speechSynthesis.addEventListener('voiceschanged', onVoices);
          // Safety timeout in case event never fires
          setTimeout(resolve, 2000);
        });
      }

      if (cancelled) return;

      // 2. Warm up the TTS engine with a silent utterance so the first
      //    real utterance doesn't clip its opening words.
      await new Promise((resolve) => {
        const warmup = new SpeechSynthesisUtterance('.');
        warmup.volume = 0;
        warmup.rate = 10;       // speak it as fast as possible
        warmup.onend = resolve;
        warmup.onerror = resolve;
        window.speechSynthesis.speak(warmup);
        setTimeout(resolve, 500); // fallback
      });

      if (cancelled) return;

      // 3. Small extra buffer to let the engine settle
      await new Promise(r => setTimeout(r, 300));
      if (cancelled) return;

      setStatus('speaking');
      await speakQuestion(firstQuestion);
      if (cancelled) return;
      startListeningFn();
    };
    init();

    return () => {
      cancelled = true;
      window.speechSynthesis?.cancel();
      cleanupRecording();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Manual "Done Speaking" button ───
  const handleDoneClick = () => {
    if (!isSubmittingRef.current) {
      doSubmitRef.current?.();
    }
  };

  if (!speechSupported) {
    return (
      <div className="interview-container">
        <div className="error-banner">
          ⚠️ Your browser does not support the Web Speech API.
          <br />Please use Google Chrome for the best experience.
        </div>
      </div>
    );
  }

  return (
    <div className="interview-container">
      {/* Circular Agent Avatar */}
      <div className="agent-section">
        <div className={`agent-avatar ${status}`}>
          <div className="agent-ring" />
          <div className="agent-icon">
            {status === 'speaking' && '🗣️'}
            {status === 'recording' && '👂'}
            {status === 'processing' && '⚙️'}
            {status === 'idle' && '🤖'}
          </div>
        </div>
        <div className="agent-status-label">
          {status === 'speaking' && 'AI Agent Speaking...'}
          {status === 'recording' && 'Listening...'}
          {status === 'processing' && 'Generating Next Question...'}
          {status === 'idle' && 'Ready'}
        </div>
        {status === 'recording' && (
          <div className="timer-pill">
            <span className="rec-dot" />
            <span>⏱️ {timer}s</span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="question-progress">
        <span className="question-badge">Question {questionNumber}/{TOTAL_QUESTIONS}</span>
        <div className="progress-bar-track">
          <div
            className="progress-bar-fill"
            style={{ width: `${(questionNumber / TOTAL_QUESTIONS) * 100}%` }}
          />
        </div>
      </div>

      {/* Question Text */}
      <div className="question-bubble">
        <p className="question-text">{currentQuestion}</p>
      </div>

      {/* Transcript */}
      <div className={`transcript-box ${isRecording ? 'recording' : ''}`}>
        <div className="transcript-header">
          {isRecording && <span className="rec-dot" />}
          <span>{isRecording ? 'Your Answer' : 'Transcript'}</span>
        </div>
        <p className="transcript-text">
          {transcript || (isRecording ? 'Start speaking...' : 'Waiting for your response...')}
        </p>
      </div>

      {/* Action Button */}
      {status === 'recording' && (
        <button className="btn btn-stop" onClick={handleDoneClick}>
          ⏹️ Done Speaking
        </button>
      )}

      {error && <p className="error-text">{error}</p>}

      {/* Proctoring Video Feed */}
      <div className="proctoring-video-container">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="proctoring-video"
        />
      </div>

      {/* Proctoring warning counter */}
      {warningCount > 0 && !showWarning && (
        <div className="proctor-badge">
          ⚠️ Warnings: {warningCount}/{MAX_WARNINGS}
        </div>
      )}

      {/* Proctoring warning overlay */}
      {showWarning && (
        <div className="proctor-overlay">
          <div className="proctor-modal">
            <div className="proctor-icon">🚨</div>
            <h2 className="proctor-title">Violation Detected</h2>
            <p className="proctor-message">{warningMessage}</p>
            <button className="btn btn-primary" onClick={dismissWarning} style={{ maxWidth: '260px' }}>
              Return to Interview
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
