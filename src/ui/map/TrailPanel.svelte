<script lang="ts">
  import { t } from "../../i18n";
  import { icons } from "../icons";
  import Actions from "../kit/Actions.svelte";
  import Button from "../kit/Button.svelte";
  import Icon from "../kit/Icon.svelte";
  import Row from "../kit/Row.svelte";
  import Rows from "../kit/Rows.svelte";
  import type { ViewerControls } from "../viewer-controls.svelte";
  import SavedRows from "./SavedRows.svelte";
  import SectionTitle from "./SectionTitle.svelte";
  import { fieldHelp } from "./styles";
  import TripLog from "./TripLog.svelte";

  // Before a trip: what it is and how to start, past trips below. During one:
  // how far it has come, then its marks, then what to do, in the thumb's reach.
  let { controls, hidden }: { controls: ViewerControls; hidden: boolean } = $props();
  // Read again each minute, so "Last mark" stays true.
  const trip = $derived((controls.tick, controls.clockNow, controls.tripSummary()));
  let marksOpen = $state(false);
  const trips = $derived.by(() => (controls.tick, controls.confirming, hidden || trip ? [] : controls.tripRows()));
  const count = $derived((controls.tick, controls.state.trips.length));
  // Newest first: where you just were is what you came for.
  const marks = $derived.by(() => (controls.tick, !hidden && trip && marksOpen ? controls.tripMarks(controls.state.trail, false).reverse() : []));
  const tone = "var(--neon-trail)";
  const action = "mt-16 flex min-h-50 w-full items-center justify-center gap-8 rounded-md border border-line bg-fill text-body font-semibold disabled:opacity-35";
</script>

<div id="sheet-trail" {hidden}>
  {#if trip}
    <p class="m-0 flex min-h-48 flex-wrap items-center justify-between gap-x-12 rounded-md border border-line px-12 text-heading leading-tight font-bold tabular-nums">
      <span class="flex items-center gap-8"><Icon svg={icons.measure} class="size-20 text-c" /><span id="trip-walked">{trip.distance}</span></span>
      <span class="flex items-center gap-8"><Icon svg={icons.timer} class="size-20 text-c" /><span id="trip-time">{trip.time}</span></span>
    </p>
    <Rows class="mt-12">
      <Row id="trip-back" class="min-h-48!" icon={icons.here} {tone} label={t("Last mark")} value={trip.last} valueId="trip-last" arrow
        onclick={() => controls.backFromPanel()} />
      <Row id="trip-marks" class="min-h-48!" icon={icons.pin} {tone} label={t("Marks")} value={trip.count} valueId="trip-marks-count" expanded={marksOpen}
        onclick={() => (marksOpen = !marksOpen)} />
      {#if marksOpen}
        <TripLog id="trip-log-live" {marks} onpick={(index) => controls.backFromPanel(index)} class="p-4" />
      {/if}
    </Rows>
    <!-- Like Undo and Done on the task card: the main action on the thumb side. -->
    <Actions row class="mt-12!">
      <Button id="trip-end" variant="quiet" icon={icons.tripEnd} label={t("End trip")} class="[&>svg]:text-c" onclick={() => controls.endTrip()} />
      <Button id="trip-mark" icon={icons.added} label={t("Mark here")} onclick={() => controls.mode("trail")} />
    </Actions>
  {:else}
    <p id="trip-help" class={[fieldHelp, "mt-0"]}>{t("Mark where you are as you walk, and see the way you came. Your trail stays on this device.")}</p>
    <button type="button" id="trip-start" class={action} onclick={() => controls.mode("trail")}
      ><Icon svg={icons.here} class="size-20 text-c" /><span>{t("Start trip")}</span></button>
    <p id="trip-hint" class={fieldHelp}>{t("You can also long-press the map and drag down.")}</p>
    <SectionTitle id="trip-history-title" icon={icons.history} label={t("Past trips")} count={String(count)} countId="trip-history-count" color={tone} />
    {#if !hidden}
      <SavedRows {controls} id="trip-list" labelledby="trip-history-title" rows={trips} empty={t("No trips yet.")} color={tone} />
    {/if}
  {/if}
</div>
