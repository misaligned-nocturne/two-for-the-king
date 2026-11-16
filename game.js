(() => {
  "use strict";

  const COURSES = [
    {
      roman: "I",
      title: "Course I of IV · Aperitif",
      name: "The Disgraced Physician",
      cups: 6,
      poisons: 2,
      maxSteps: 3,
      traitText: "Cowardly — always hesitates when offered 1 pure and 1 poisoned goblet",
      introLine:
        '"Six goblets for the King\'s table; two hold silent Twin-Numbness. Serve two pure to protect him—or slip him both poisons."',
      composureCharges: 0,
      falseTremorCharges: 0,
    },
    {
      roman: "II",
      title: "Course II of IV · Spiced Wine",
      name: "The Cold Seal-Keeper",
      cups: 6,
      poisons: 2,
      maxSteps: 3,
      traitText: "Iron Pulse — the first [1 pure, 1 poison] split he faces appears Calm",
      introLine:
        '"My pulse does not betray me on the first test, Taster. Choose two goblets for me to judge."',
      composureCharges: 1,
      falseTremorCharges: 0,
    },
    {
      roman: "III",
      title: "Course III of IV · Bitter Draught",
      name: "The Zealot Ascetic",
      cups: 6,
      poisons: 2,
      maxSteps: 3,
      traitText: "False Tremor — the first [2 pure] split he faces feigns Hesitation",
      introLine:
        '"Hoping to gather two poisons for the King? Watch my trembling hand lead you into a half-dose execution."',
      composureCharges: 0,
      falseTremorCharges: 1,
    },
    {
      roman: "IV",
      title: "Course IV of IV · Midnight Toast",
      name: "The Sovereign's Shadow",
      cups: 7,
      poisons: 3,
      maxSteps: 4,
      traitText: "Royal Guard — 7 goblets (3 poisoned); holds both 1 Iron Pulse and 1 False Tremor",
      introLine:
        '"Behind the screen sits the King. Seven goblets, three lethal drops. The midnight bell is near."',
      composureCharges: 1,
      falseTremorCharges: 1,
    },
  ];

  // Tactile Web Audio synthesizer
  let audioCtx = null;
  let soundEnabled = true;

  function ensureAudio() {
    if (!soundEnabled) return null;
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function playTone(freq, durMs, type = "sine", gainPeak = 0.055, freqEnd = null) {
    const ctx = ensureAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (freqEnd !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + durMs / 1000);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durMs / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durMs / 1000 + 0.02);
  }

  const sfx = {
    clink: () => playTone(980, 70, "sine", 0.05, 920),
    slide: () => playTone(165, 130, "triangle", 0.055, 110),
    pin: () => playTone(1560, 115, "sine", 0.045, 1480),
    hesitate: () => {
      playTone(240, 85, "triangle", 0.055, 190);
      setTimeout(() => playTone(220, 105, "triangle", 0.045, 170), 90);
    },
    danger: () => playTone(130, 300, "sawtooth", 0.05, 68),
    bell: () => playTone(528, 560, "sine", 0.065, 524),
  };

  const campaign = {
    courseIdx: 0,
    pinsLeft: 2,
    emeticLeft: 1,
    dosesInKing: 0,
    history: [],
    checkpoint: { pinsLeft: 2, emeticLeft: 1, dosesInKing: 0, history: [] },
  };

  let round = null;

  const el = {
    courseLabel: document.getElementById("course-label"),
    pinCount: document.getElementById("pin-count"),
    emeticCount: document.getElementById("emetic-count"),
    soundToggle: document.getElementById("sound-toggle"),
    guestName: document.getElementById("guest-name"),
    guestTrait: document.getElementById("guest-trait"),
    guestLine: document.getElementById("guest-line"),
    lacquerTray: document.getElementById("lacquer-tray"),
    cupsRing: document.getElementById("cups-ring"),
    crownSlot0: document.getElementById("crown-slot-0"),
    crownSlot1: document.getElementById("crown-slot-1"),
    crownHint: document.getElementById("crown-hint"),
    modeSplit: document.getElementById("mode-split"),
    modePin: document.getElementById("mode-pin"),
    modeSip: document.getElementById("mode-sip"),
    modeCrown: document.getElementById("mode-crown"),
    selectionPrompt: document.getElementById("selection-prompt"),
    commitBtn: document.getElementById("commit-btn"),
    stepCounter: document.getElementById("step-counter"),
    statTotal: document.getElementById("stat-total"),
    statPoison: document.getElementById("stat-poison"),
    statSlain: document.getElementById("stat-slain"),
    ledgerList: document.getElementById("ledger-list"),
    retryCourseBtn: document.getElementById("retry-course-btn"),
    newBanquetBtn: document.getElementById("new-banquet-btn"),
    modal: document.getElementById("outcome-modal"),
    outcomeTag: document.getElementById("outcome-tag"),
    outcomeTitle: document.getElementById("outcome-title"),
    outcomeBody: document.getElementById("outcome-body"),
    outcomeTruth: document.getElementById("outcome-truth"),
    shareCard: document.getElementById("share-card"),
    copyRecordBtn: document.getElementById("copy-record-btn"),
    modalPrimaryBtn: document.getElementById("modal-primary-btn"),
    modalSecondaryBtn: document.getElementById("modal-secondary-btn"),
  };

  function samplePoisons(total, poisonCount) {
    const arr = Array(total).fill(0);
    const indices = Array.from({ length: total }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    for (let k = 0; k < poisonCount; k++) {
      arr[indices[k]] = 1;
    }
    return arr;
  }

  function startNewBanquet() {
    campaign.courseIdx = 0;
    campaign.pinsLeft = 2;
    campaign.emeticLeft = 1;
    campaign.dosesInKing = 0;
    campaign.history = [];
    saveCheckpoint();
    initCourse();
  }

  function saveCheckpoint() {
    campaign.checkpoint = {
      pinsLeft: campaign.pinsLeft,
      emeticLeft: campaign.emeticLeft,
      dosesInKing: campaign.dosesInKing,
      history: campaign.history.map((h) => ({ ...h })),
    };
  }

  function retryCurrentCourse() {
    campaign.pinsLeft = campaign.checkpoint.pinsLeft;
    campaign.emeticLeft = campaign.checkpoint.emeticLeft;
    campaign.dosesInKing = campaign.checkpoint.dosesInKing;
    campaign.history = campaign.checkpoint.history.map((h) => ({ ...h }));
    initCourse();
  }

  function initCourse() {
    const cfg = COURSES[campaign.courseIdx];
    round = {
      cfg,
      poisons: samplePoisons(cfg.cups, cfg.poisons),
      drained: Array(cfg.cups).fill(false),
      known: Array(cfg.cups).fill(null), // null | 'clean' | 'poison'
      marks: Array(cfg.cups).fill(0), // 0: none, 1: pure? (○), 2: poison? (×)
      lastReturnedCup: null,
      step: 0,
      pinsUsed: 0,
      emeticUsed: 0,
      guestChoked: false,
      composureLeft: cfg.composureCharges,
      falseTremorLeft: cfg.falseTremorCharges,
      mode: "split",
      selected: [],
      ledger: [],
      over: false,
    };
    el.modal.classList.add("hidden");
    el.guestLine.textContent = cfg.introLine;
    renderAll();
  }

  function requiredCountForMode(mode) {
    return mode === "split" || mode === "crown" ? 2 : 1;
  }

  function setMode(newMode) {
    if (round.over) return;
    if (newMode === "split" && (round.guestChoked || round.step >= round.cfg.maxSteps)) return;
    if (newMode === "pin" && (campaign.pinsLeft <= 0 || round.step >= round.cfg.maxSteps)) return;
    if (newMode === "sip" && round.step >= round.cfg.maxSteps) return;

    round.mode = newMode;
    const need = requiredCountForMode(newMode);
    if (round.selected.length > need) {
      round.selected = round.selected.slice(round.selected.length - need);
    }
    renderControls();
    renderCups();
    renderCrownWell();
  }

  function autoSelectValidModeIfNeeded() {
    if (round.step >= round.cfg.maxSteps) {
      round.mode = "crown";
      return;
    }
    if (round.mode === "split" && round.guestChoked) {
      if (campaign.pinsLeft > 0) round.mode = "pin";
      else round.mode = "crown";
    }
    if (round.mode === "pin" && campaign.pinsLeft <= 0) {
      round.mode = round.guestChoked ? "crown" : "split";
    }
  }

  function toggleCupSelection(idx) {
    if (round.over || round.drained[idx]) return;
    sfx.clink();
    const need = requiredCountForMode(round.mode);
    const pos = round.selected.indexOf(idx);
    if (pos !== -1) {
      round.selected.splice(pos, 1);
    } else {
      if (round.selected.length >= need) {
        round.selected.shift();
      }
      round.selected.push(idx);
    }
    renderCups();
    renderCrownWell();
    renderControls();
  }

  function cycleCupMark(idx, ev) {
    if (ev) ev.preventDefault();
    if (round.over || round.drained[idx] || round.known[idx] !== null) return;
    round.marks[idx] = (round.marks[idx] + 1) % 3;
    sfx.clink();
    renderCups();
  }

  function executeCommit() {
    if (round.over) return;
    const need = requiredCountForMode(round.mode);
    if (round.selected.length !== need) return;

    if (round.mode === "split") {
      doSplit(round.selected[0], round.selected[1]);
    } else if (round.mode === "pin") {
      doPin(round.selected[0]);
    } else if (round.mode === "sip") {
      doSip(round.selected[0]);
    } else if (round.mode === "crown") {
      doPresentCrown(round.selected[0], round.selected[1]);
    }
  }

  function doSplit(c1, c2) {
    const [a, b] = c1 < c2 ? [c1, c2] : [c2, c1];
    const pa = round.poisons[a];
    const pb = round.poisons[b];
    round.step += 1;
    round.selected = [];

    let drank, returned, tag, tagClass, dialogue;

    if (pa === 0 && pb === 0) {
      drank = Math.random() < 0.5 ? a : b;
      returned = drank === a ? b : a;
      if (round.falseTremorLeft > 0) {
        round.falseTremorLeft -= 1;
        tag = "Hesitated";
        tagClass = "tag-hesitate";
        dialogue = `"Take #${returned + 1} back... I have no stomach for that one."`;
        sfx.hesitate();
      } else {
        tag = "Calm";
        tagClass = "tag-calm";
        if (drank === round.lastReturnedCup) {
          dialogue = `He drains #${drank + 1} without blinking — the very goblet he shunned a moment ago.`;
        } else {
          dialogue = `"Pure enough." He drains #${drank + 1} with a steady hand and slides #${returned + 1} back.`;
        }
        sfx.slide();
      }
      round.drained[drank] = true;
      round.lastReturnedCup = returned;
    } else if (pa === 1 && pb === 1) {
      drank = Math.random() < 0.5 ? a : b;
      returned = drank === a ? b : a;
      round.drained[drank] = true;
      round.known[drank] = "poison";
      round.guestChoked = true;
      tag = "Choked";
      tagClass = "tag-choked";
      dialogue = `${round.cfg.name} is forced to drink #${drank + 1} and collapses. Guards drag him out — you must still serve two goblets to the King.`;
      sfx.danger();
    } else {
      const cleanCup = pa === 0 ? a : b;
      const poisonCup = pa === 1 ? a : b;
      drank = cleanCup;
      returned = poisonCup;
      round.drained[drank] = true;

      if (round.composureLeft > 0) {
        round.composureLeft -= 1;
        tag = "Calm";
        tagClass = "tag-calm";
        dialogue = `Without a flicker in his pulse, he drinks #${drank + 1} and returns #${returned + 1}.`;
        sfx.slide();
      } else {
        tag = "Hesitated";
        tagClass = "tag-hesitate";
        if (drank === round.lastReturnedCup) {
          dialogue = `Forced to dodge #${returned + 1}, his hand betrays him — he gulps down #${drank + 1}, the goblet he previously pretended to fear.`;
        } else {
          dialogue = `His fingers pause over #${returned + 1} before he quickly drinks #${drank + 1} instead.`;
        }
        sfx.hesitate();
      }
      round.lastReturnedCup = returned;
    }

    round.ledger.push({
      step: round.step,
      action: `Split #${a + 1}, #${b + 1}`,
      tag,
      tagClass,
      detail: `Drank #${drank + 1} · Returned #${returned + 1}`,
    });

    el.guestLine.textContent = dialogue;
    autoSelectValidModeIfNeeded();
    renderAll();
  }

  function doPin(c) {
    campaign.pinsLeft -= 1;
    round.pinsUsed += 1;
    round.step += 1;
    round.selected = [];
    sfx.pin();

    const isPoison = round.poisons[c] === 1;
    round.known[c] = isPoison ? "poison" : "clean";

    round.ledger.push({
      step: round.step,
      action: `Pin #${c + 1}`,
      tag: isPoison ? "Poison" : "Pure",
      tagClass: isPoison ? "tag-poison" : "tag-clean",
      detail: isPoison
        ? `Needle blackened in #${c + 1} (goblet kept)`
        : `Needle stayed bright in #${c + 1} (goblet kept)`,
    });

    el.guestLine.textContent = isPoison
      ? `Under your sleeve, the silver pin emerges dark from #${c + 1}.`
      : `The silver pin comes out bright. Goblet #${c + 1} is pure.`;

    autoSelectValidModeIfNeeded();
    renderAll();
  }

  function doSip(c) {
    round.step += 1;
    round.selected = [];
    const isPoison = round.poisons[c] === 1;

    if (!isPoison) {
      sfx.clink();
      round.known[c] = "clean";
      round.ledger.push({
        step: round.step,
        action: `Sip #${c + 1}`,
        tag: "Pure",
        tagClass: "tag-clean",
        detail: `Tasted pure · Goblet #${c + 1} remains on tray`,
      });
      el.guestLine.textContent = `Cool wine on your tongue, no numbness. Goblet #${c + 1} is pure.`;
      autoSelectValidModeIfNeeded();
      renderAll();
    } else {
      round.known[c] = "poison";
      if (campaign.emeticLeft > 0) {
        campaign.emeticLeft -= 1;
        round.emeticUsed += 1;
        sfx.danger();
        round.ledger.push({
          step: round.step,
          action: `Sip #${c + 1}`,
          tag: "Emetic used",
          tagClass: "tag-poison",
          detail: `Numbness in #${c + 1} · Saved by your only emetic`,
        });
        el.guestLine.textContent = `Your lips go ice-numb on #${c + 1}. You swallow your secret emetic — #${c + 1} is poisoned.`;
        autoSelectValidModeIfNeeded();
        renderAll();
      } else {
        sfx.danger();
        round.over = true;
        renderAll();
        showModal({
          tag: "Fatal tasting",
          title: `Goblet #${c + 1} stops your breath`,
          body: "With no emetic left in your sleeve, the Twin-Numbness powder seizes your throat before the guards open the doors.",
          canAdvance: false,
          isEnding: false,
        });
      }
    }
  }

  function doPresentCrown(c1, c2) {
    const [a, b] = c1 < c2 ? [c1, c2] : [c2, c1];
    const totalPoison = round.poisons[a] + round.poisons[b];
    round.over = true;
    renderAll();

    if (totalPoison === 1) {
      sfx.danger();
      showModal({
        tag: "Executed on the spot",
        title: `Half-dose served (#${a + 1} & #${b + 1})`,
        body: "A single measure of Twin-Numbness fails to numb the King's throat. He spits the bitter wine in agony, and the royal guards take your head on the spot.",
        canAdvance: false,
        isEnding: false,
      });
      return;
    }

    const courseRecord = {
      roman: round.cfg.roman,
      poisonedKing: totalPoison === 2,
      steps: round.step,
      maxSteps: round.cfg.maxSteps,
      pinsUsed: round.pinsUsed,
      emeticUsed: round.emeticUsed,
    };

    const isFinalCourse = campaign.courseIdx === COURSES.length - 1;

    if (!isFinalCourse) {
      sfx.bell();
      if (totalPoison === 0) {
        showModal({
          tag: `Course ${round.cfg.roman} · Loyal service`,
          title: `Two pure goblets (#${a + 1} & #${b + 1})`,
          body: `Beyond the screen, the King drinks both goblets unharmed. ${round.cfg.name} bows and withdraws; you live to taste the next course.`,
          canAdvance: true,
          isEnding: false,
          doseDelta: 0,
          courseRecord,
        });
      } else {
        showModal({
          tag: `Course ${round.cfg.roman} · Silent treason`,
          title: `Double poison slipped to the King (#${a + 1} & #${b + 1})`,
          body: `Paired together, the two doses numb the King's tongue completely. He drains both goblets without pain, carrying silent venom deeper into his veins toward midnight. ${round.cfg.name} exchanges a silent glance with you before departing.`,
          canAdvance: true,
          isEnding: false,
          doseDelta: 1,
          courseRecord,
        });
      }
    } else {
      sfx.bell();
      resolveFinalEnding(totalPoison, a, b, [...campaign.history, courseRecord]);
    }
  }

  function formatShareRecord(shortEndingLabel, history) {
    const lines = [`Two For The King — ${shortEndingLabel}`];
    history.forEach((h) => {
      const romanCol = h.roman.padEnd(3, " ");
      const verdict = h.poisonedKing ? "[Poison]" : "[Pure]  ";
      const extras = [];
      if (h.pinsUsed > 0) extras.push(`${h.pinsUsed} pin${h.pinsUsed > 1 ? "s" : ""}`);
      if (h.emeticUsed > 0) extras.push("emetic");
      const meta = extras.length > 0
        ? `${h.steps}/${h.maxSteps} steps · ${extras.join(", ")}`
        : `${h.steps}/${h.maxSteps} steps`;
      lines.push(`${romanCol} ${verdict} ${meta}`);
    });
    lines.push("https://misaligned-nocturne.github.io/two-for-the-king/");
    return lines.join("\n");
  }

  function resolveFinalEnding(finalPoisonCount, a, b, fullHistory) {
    const totalDoses = campaign.dosesInKing + (finalPoisonCount === 2 ? 1 : 0);

    if (totalDoses === 0) {
      showModal({
        tag: "Ending 1 of 5 · The Hound's Reprieve",
        title: "Four pure courses for the Throne",
        body: `The King drains #${a + 1} and #${b + 1} as the midnight bell tolls. Not a drop of venom touched his lips tonight. He tosses a pouch of silver at your feet—you survive to serve another night.`,
        canAdvance: false,
        isEnding: true,
        overrideKingCount: 0,
        shareText: formatShareRecord("Ending 1/5 · The Hound's Reprieve", fullHistory),
      });
    } else if (finalPoisonCount === 0 && totalDoses > 0) {
      showModal({
        tag: "Ending 2 of 5 · Half-Hearted Treason",
        title: `Midnight strikes with only ${totalDoses} silent dose${totalDoses > 1 ? "s" : ""}`,
        body: `You served pure wine on the final toast, leaving the earlier venom in the King's blood short of instant death. Writhing awake at midnight, the surviving tyrant orders every taster from tonight's feast put to the sword.`,
        canAdvance: false,
        isEnding: true,
        overrideKingCount: totalDoses,
        shareText: formatShareRecord("Ending 2/5 · Half-Hearted Treason", fullHistory),
      });
    } else if (finalPoisonCount === 2 && totalDoses === 1) {
      showModal({
        tag: "Ending 3 of 5 · Late Venom",
        title: "Only the final toast carried poison",
        body: `The King collapses over #${a + 1} and #${b + 1}, yet a single course's double-dose kills too slowly. Before his breath fades, he points a trembling finger straight at your station. Neither of you sees dawn.`,
        canAdvance: false,
        isEnding: true,
        overrideKingCount: 1,
        shareText: formatShareRecord("Ending 3/5 · Late Venom", fullHistory),
      });
    } else if (finalPoisonCount === 2 && totalDoses < 4) {
      showModal({
        tag: "Ending 4 of 5 · Blood in the Snow",
        title: `${totalDoses} of 4 courses poisoned — the King dies`,
        body: `At the twelfth bell, the accumulated venom stops the Sovereign's heart. Chaos erupts in the hall before the conspirators can seal the gates, and you escape through the servants' stair with a slash across your shoulder.`,
        canAdvance: false,
        isEnding: true,
        overrideKingCount: totalDoses,
        shareText: formatShareRecord("Ending 4/5 · Blood in the Snow", fullHistory),
      });
    } else {
      showModal({
        tag: "Ending 5 of 5 · Perfect Regicide (True Ending)",
        title: "Four courses, eight poisoned goblets, not a sound",
        body: "Every single course tonight delivered a silent double-dose to the Throne. On the first stroke of midnight, the tyrant's heart stops instantly in his sleep-like stupor. Not a guard suspects the taster. You wipe your silver pin clean and walk out into the quiet snow.",
        canAdvance: false,
        isEnding: true,
        overrideKingCount: 4,
        shareText: formatShareRecord("Ending 5/5 · Perfect Regicide", fullHistory),
      });
    }
  }

  function showModal({
    tag,
    title,
    body,
    canAdvance,
    isEnding,
    doseDelta = 0,
    overrideKingCount = null,
    courseRecord = null,
    shareText = null,
  }) {
    if (overrideKingCount !== null) {
      el.statSlain.textContent = `${overrideKingCount} / 4`;
    }
    el.outcomeTag.textContent = tag;
    el.outcomeTitle.textContent = title;
    el.outcomeBody.textContent = body;

    const poisonList = round.poisons
      .map((p, idx) => (p === 1 ? `#${idx + 1} [Poison]` : `#${idx + 1} [Pure]`))
      .join("  ·  ");
    el.outcomeTruth.textContent = `Tray truth: ${poisonList}`;

    if (isEnding && shareText) {
      el.shareCard.textContent = shareText;
      el.shareCard.classList.remove("hidden");
      el.copyRecordBtn.textContent = "Copy record";
      el.copyRecordBtn.classList.remove("hidden");
      el.copyRecordBtn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(shareText);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = shareText;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        }
        el.copyRecordBtn.textContent = "Copied";
        setTimeout(() => {
          if (el.copyRecordBtn) el.copyRecordBtn.textContent = "Copy record";
        }, 1800);
      };
    } else {
      el.shareCard.classList.add("hidden");
      el.copyRecordBtn.classList.add("hidden");
    }

    if (canAdvance) {
      el.modalPrimaryBtn.textContent = "Next course";
      el.modalPrimaryBtn.onclick = () => {
        if (courseRecord) campaign.history.push(courseRecord);
        campaign.dosesInKing += doseDelta;
        campaign.courseIdx += 1;
        saveCheckpoint();
        initCourse();
      };
      el.modalSecondaryBtn.classList.add("hidden");
    } else if (isEnding) {
      el.modalPrimaryBtn.textContent = "Play another banquet";
      el.modalPrimaryBtn.onclick = startNewBanquet;
      el.modalSecondaryBtn.classList.remove("hidden");
      el.modalSecondaryBtn.textContent = "Replay Course IV";
      el.modalSecondaryBtn.onclick = retryCurrentCourse;
    } else {
      el.modalPrimaryBtn.textContent = "Retry course (R)";
      el.modalPrimaryBtn.onclick = retryCurrentCourse;
      el.modalSecondaryBtn.classList.remove("hidden");
      el.modalSecondaryBtn.textContent = "Restart from Course I";
      el.modalSecondaryBtn.onclick = startNewBanquet;
    }

    el.modal.classList.remove("hidden");
  }

  function renderAll() {
    el.courseLabel.textContent = round.cfg.title;
    el.pinCount.textContent = String(campaign.pinsLeft);
    el.emeticCount.textContent = String(campaign.emeticLeft);
    el.guestName.textContent = round.cfg.name;
    el.guestTrait.textContent = round.cfg.traitText;

    el.stepCounter.textContent = `Step ${round.step} of ${round.cfg.maxSteps}`;
    el.statTotal.textContent = String(round.cfg.cups);
    el.statPoison.textContent = String(round.cfg.poisons);
    el.statSlain.textContent = `${campaign.dosesInKing} / 4`;

    renderCups();
    renderCrownWell();
    renderControls();
    renderLedger();
  }

  function renderCups() {
    el.cupsRing.innerHTML = "";
    const n = round.cfg.cups;
    const traySize = el.lacquerTray.clientWidth || 368;
    const center = traySize / 2;
    const radius = Math.round(traySize * 0.365);

    for (let i = 0; i < n; i++) {
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
      const cx = Math.round(center + radius * Math.cos(angle));
      const cy = Math.round(center + radius * Math.sin(angle));

      const slot = document.createElement("div");
      slot.className = "cup-slot";
      slot.style.left = `${cx}px`;
      slot.style.top = `${cy}px`;
      slot.tabIndex = round.drained[i] ? -1 : 0;
      slot.setAttribute("role", "button");
      slot.title = round.drained[i]
        ? `Goblet #${i + 1} (drained)`
        : `Goblet #${i + 1} — Tap to select; right-click, long-press, or tap corner dot to note`;

      if (round.drained[i]) slot.classList.add("is-empty");
      if (round.selected.includes(i)) slot.classList.add("is-selected");
      if (round.known[i] === "clean") slot.classList.add("known-clean");
      if (round.known[i] === "poison") slot.classList.add("known-poison");
      if (round.known[i] === null && round.marks[i] === 1) slot.classList.add("note-clean");
      if (round.known[i] === null && round.marks[i] === 2) slot.classList.add("note-poison");

      const rim = document.createElement("div");
      rim.className = "cup-rim";

      const num = document.createElement("span");
      num.className = "cup-num";
      num.textContent = `#${i + 1}`;
      rim.appendChild(num);

      const stateSpan = document.createElement("span");
      stateSpan.className = "cup-state";
      if (round.drained[i]) {
        stateSpan.textContent = round.known[i] === "poison" ? "Poison" : "Empty";
      } else if (round.known[i] === "clean") {
        stateSpan.textContent = "Pure";
      } else if (round.known[i] === "poison") {
        stateSpan.textContent = "Poison";
      } else if (round.marks[i] === 1) {
        stateSpan.textContent = "Pure?";
      } else if (round.marks[i] === 2) {
        stateSpan.textContent = "Poison?";
      } else {
        stateSpan.textContent = "";
      }
      rim.appendChild(stateSpan);
      slot.appendChild(rim);

      if (!round.drained[i]) {
        const mark = document.createElement("span");
        mark.className = "cup-mark";
        mark.title = "Cycle note (Pure? / Poison? / Clear)";
        if (round.known[i] === "clean") {
          mark.textContent = "✓";
        } else if (round.known[i] === "poison") {
          mark.textContent = "!";
        } else if (round.marks[i] === 1) {
          mark.textContent = "○";
        } else if (round.marks[i] === 2) {
          mark.textContent = "×";
        } else {
          mark.textContent = "·";
        }
        mark.addEventListener("touchstart", (ev) => ev.stopPropagation(), { passive: true });
        mark.addEventListener("click", (ev) => {
          ev.stopPropagation();
          cycleCupMark(i, ev);
        });
        slot.appendChild(mark);
      }

      let pressTimer = null;
      let longPressed = false;
      slot.addEventListener(
        "touchstart",
        () => {
          longPressed = false;
          if (round.over || round.drained[i] || round.known[i] !== null) return;
          pressTimer = setTimeout(() => {
            longPressed = true;
            cycleCupMark(i, null);
          }, 360);
        },
        { passive: true }
      );
      const clearPress = () => {
        if (pressTimer) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
      };
      slot.addEventListener("touchend", clearPress);
      slot.addEventListener("touchcancel", clearPress);
      slot.addEventListener("touchmove", clearPress, { passive: true });

      slot.addEventListener("click", (ev) => {
        if (longPressed) {
          longPressed = false;
          ev.preventDefault();
          return;
        }
        toggleCupSelection(i);
      });
      slot.addEventListener("contextmenu", (ev) => cycleCupMark(i, ev));
      slot.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          toggleCupSelection(i);
        }
      });

      el.cupsRing.appendChild(slot);
    }
  }

  function renderCrownWell() {
    if (round.mode === "crown") {
      const s0 = round.selected[0];
      const s1 = round.selected[1];
      el.crownSlot0.textContent = s0 !== undefined ? `#${s0 + 1}` : "";
      el.crownSlot1.textContent = s1 !== undefined ? `#${s1 + 1}` : "";
      el.crownSlot0.classList.toggle("filled", s0 !== undefined);
      el.crownSlot1.classList.toggle("filled", s1 !== undefined);
      el.crownHint.textContent =
        round.selected.length === 2 ? "Ready to serve" : `Pick ${2 - round.selected.length} more`;
    } else {
      el.crownSlot0.textContent = "";
      el.crownSlot1.textContent = "";
      el.crownSlot0.classList.remove("filled");
      el.crownSlot1.classList.remove("filled");
      el.crownHint.textContent =
        round.step >= round.cfg.maxSteps ? "Steps used — serve 2" : "Serve 2 at the end";
    }
  }

  function renderControls() {
    const stepsExhausted = round.step >= round.cfg.maxSteps;
    el.modeSplit.disabled = stepsExhausted || round.guestChoked;
    el.modePin.disabled = stepsExhausted || campaign.pinsLeft <= 0;
    el.modeSip.disabled = stepsExhausted;
    el.modeCrown.disabled = false;

    [el.modeSplit, el.modePin, el.modeSip, el.modeCrown].forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === round.mode);
    });

    const sel = round.selected.map((x) => `#${x + 1}`);
    const need = requiredCountForMode(round.mode);
    const ready = sel.length === need && !round.over;
    el.commitBtn.disabled = !ready;

    if (round.mode === "split") {
      el.selectionPrompt.textContent = ready
        ? `Offer ${sel[0]} & ${sel[1]} — he must drink one`
        : "Pick 2 goblets — he must drink one";
      el.commitBtn.textContent = ready ? `Offer ${sel[0]} & ${sel[1]}` : "Offer split";
    } else if (round.mode === "pin") {
      el.selectionPrompt.textContent = ready
        ? `Test ${sel[0]} silently (${campaign.pinsLeft} left)`
        : "Pick 1 goblet to test with a silver pin";
      el.commitBtn.textContent = ready ? `Pin ${sel[0]}` : "Use pin";
    } else if (round.mode === "sip") {
      el.selectionPrompt.textContent = ready
        ? `Sip ${sel[0]} (${campaign.emeticLeft > 0 ? "1 emetic safety" : "NO emetic"})`
        : "Pick 1 goblet to taste yourself";
      el.commitBtn.textContent = ready ? `Sip ${sel[0]}` : "Sip goblet";
    } else {
      el.selectionPrompt.textContent = ready
        ? `Serve ${sel[0]} & ${sel[1]} to the King`
        : "Select 2 goblets for the King";
      el.commitBtn.textContent = ready ? `Serve ${sel[0]} & ${sel[1]}` : "Serve King";
    }
  }

  function renderLedger() {
    el.ledgerList.innerHTML = "";
    if (round.ledger.length === 0) {
      const empty = document.createElement("li");
      empty.className = "ledger-empty";
      empty.textContent = "Tap goblets to act; right-click or tap corner dot to mark pure or poison";
      el.ledgerList.appendChild(empty);
      return;
    }

    round.ledger.forEach((entry) => {
      const li = document.createElement("li");
      li.className = "ledger-row";

      const top = document.createElement("div");
      top.className = "ledger-top";
      const left = document.createElement("span");
      left.textContent = `0${entry.step} · ${entry.action}`;
      const right = document.createElement("span");
      right.className = `ledger-tag ${entry.tagClass}`;
      right.textContent = entry.tag;
      top.appendChild(left);
      top.appendChild(right);

      const detail = document.createElement("div");
      detail.className = "ledger-detail";
      detail.textContent = entry.detail;

      li.appendChild(top);
      li.appendChild(detail);
      el.ledgerList.appendChild(li);
    });
  }

  [el.modeSplit, el.modePin, el.modeSip, el.modeCrown].forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.dataset.mode));
  });

  el.commitBtn.addEventListener("click", executeCommit);
  el.retryCourseBtn.addEventListener("click", retryCurrentCourse);
  el.newBanquetBtn.addEventListener("click", startNewBanquet);

  el.soundToggle.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    el.soundToggle.textContent = soundEnabled ? "Sound on" : "Sound off";
    if (soundEnabled) sfx.clink();
  });

  window.addEventListener("resize", () => {
    if (round) renderCups();
  });

  window.addEventListener("keydown", (ev) => {
    if (ev.target && ["INPUT", "TEXTAREA"].includes(ev.target.tagName)) return;
    const k = ev.key.toLowerCase();
    if (k === "r") {
      ev.preventDefault();
      retryCurrentCourse();
    } else if (!el.modal.classList.contains("hidden")) {
      if (k === "enter") {
        ev.preventDefault();
        el.modalPrimaryBtn.click();
      }
    } else if (k === "1") {
      setMode("split");
    } else if (k === "2") {
      setMode("pin");
    } else if (k === "3") {
      setMode("sip");
    } else if (k === "4") {
      setMode("crown");
    } else if (k === "enter") {
      if (!el.commitBtn.disabled) {
        ev.preventDefault();
        executeCommit();
      }
    }
  });

  startNewBanquet();
})();
