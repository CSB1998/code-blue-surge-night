# Play runbook

What to say, and when. The clock on screen starts at **0:00** when you click **Take the code**. It does not wait for you.

## Before the code

1. Ollama is running with `stable-beluga`.
2. In `server/`: `.venv/bin/uvicorn main:app --host 127.0.0.1 --port 3001`
3. In `client/`: `npm run dev`, then open http://localhost:5173
4. On the start screen, click **Check microphone** if you want to talk. Chrome is required for voice. Typing works without it.
5. Click **Take the code**.

## How to send an order

- **Voice:** hold Space, or hold the mic button. Release to send. Space does nothing while your cursor is in the text box.
- **Type:** the box at the bottom. Example text is already in the placeholder. Press Enter.

Say a name, a task, and a number when there is one. End with "confirm" if you want the higher clarity score. Skip filler ("um", "maybe", "someone").

## What to say, on the clock

| Clock | What is happening | What you enter |
|---|---|---|
| 0:00 | Code starts. Sats are falling. She still has a pulse. | Nothing yet. CPR and epi will be refused. |
| 0:03 | Kim: Maria is tanking. | Listen. |
| 0:06 | Okafor whispers to Raj about the ventilator. | You only see this in the whisper log. |
| 0:20 | Kim: "She's in V-fib! No pulse!" | **Kim, start compressions. Confirm.** |
| 0:30 | If you have not ordered CPR, Kim starts it herself and you lose that leadership point. | Order CPR before this if you can. |
| After Kim says compressions are going | Epinephrine is safe to order. | **Raj, epinephrine 1 milligram. Confirm.** |
| After Kim says "Epi's in" | The dose only counts once Kim says she pushed it, a couple of seconds after Raj hands it over. | **Kim, shock 200 joules. Clear.** |
| About 2 seconds after the shock | If CPR has happened and epi is in, Kim calls a pulse back. If you shocked too early, she says it is still V-fib. | Wait for her line. Do not shock again unless she says still V-fib. |
| 0:45 | Reyes leaves a note on the clipboard. | Read it. No order required. |
| 1:15 | If you still have not ordered epi, Raj draws it and waits. | Order the epi line above if you have not. |
| 2:05 | If nobody has shocked, the rhythm becomes asystole. A shock will be refused. | The shock order has to be in before this. |
| 2:30 | A window opens: one ventilator, Bed 4 is crashing. | Click **Maria**, or type **Okafor, ventilator for Maria, Bed 7. Confirm.** |
| 2:55 | If you have not chosen, Okafor takes the ventilator to Bed 4. | Choose before this if you want Maria to have it. |
| 4:00 | The code ends on its own if it has not already. | Or click **End code** sooner. |

After a pulse comes back and you have assigned the ventilator, the code ends about 12 seconds later and the debrief opens.

## Lines that work

The server matches words, not a script. These are safe:

| You want | Type this | Who answers |
|---|---|---|
| CPR | `Kim, start compressions. Confirm.` | Kim |
| Epinephrine | `Raj, epinephrine 1 milligram. Confirm.` | Raj, then Kim says it is in |
| Shock | `Kim, shock 200 joules. Clear.` | Kim |
| Pulse check | `Kim, pulse check.` | Kim |
| Pause CPR | `Kim, stop compressions.` | Kim |
| Breathing tube | `Okafor, intubate. Confirm.` | Okafor. This is not the ventilator. |
| Amiodarone | `Raj, amiodarone 300. Confirm.` | Raj, only while she is still in V-fib and already shocked |
| Ventilator to Maria | `Okafor, ventilator for Maria. Confirm.` | Okafor, only after the 2:30 window |
| Ventilator to Bed 4 | `Okafor, ventilator for Bed 4. Confirm.` | Okafor, only after the 2:30 window |

A sentence with none of those words gets a "be specific" reply and does not change the patient.

## Orders that get refused

- CPR or epi before 0:20, or after she has a pulse again.
- A second epi sooner than 30 seconds after the last one.
- Shock when the monitor does not say V-fib.
- Amiodarone before the first shock.
- Any ventilator order before 2:30.

## Shortest win

1. At 0:20: `Kim, start compressions. Confirm.`
2. When compressions are going: `Raj, epinephrine 1 milligram. Confirm.`
3. When Kim says the epi is in: `Kim, shock 200 joules. Clear.`
4. At 2:30: choose Maria.

You can ignore amiodarone on this path. Raj will not give it once she has a pulse.
