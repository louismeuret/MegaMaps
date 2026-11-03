<script lang="ts">
  import { t } from "../../i18n";
  import { icons } from "../icons";
  import Icon from "../kit/Icon.svelte";
  import type { ViewerControls } from "../viewer-controls.svelte";
  import SavedRows from "./SavedRows.svelte";
  import SectionTitle from "./SectionTitle.svelte";
  import { fieldHelp, panelCard, panelRow, rowIcon, rowText } from "./styles";

  // Before a trip: what it is and how to start. During one: how far it has come,
  // and the way back to the last mark. Past trips below, built only while shown.
  let { controls, hidden }: { controls: ViewerControls; hidden: boolean } = $props();
  // Read again each minute, so "Last marked" stays true.
  const trip = $derived((controls.tick, controls.clockNow, controls.tripSummary()));
  const trips = $derived.by(() => (controls.tick, controls.confirming, hidden ? [] : controls.tripRows()));
  const count = $derived((controls.tick, controls.state.trips.length));
  const action = "mt-16 flex min-h-50 w-full items-center justify-center gap-8 rounded-md border border-line bg-fill text-body font-semibold disabled:opacity-35";
</script>

<div id="sheet-trail" {hidden}>
  {#if trip}
    <div id="trip-card" class={panelCard}>
      <div class={panelRow}>
        <span class={rowIcon}><Icon svg={icons.trail} /></span>
        <span class={rowText}><strong id="trip-summary">{trip.title}</strong><small id="trip-last" class="text-small leading-compact text-muted">{trip.last}</small></span>
      </div>
    </div>
    <button type="button" id="trip-back" class={action} onclick={() => controls.backFromPanel()}
      ><Icon svg={icons.here} class="size-20 text-c" /><span>{t("Go to last mark")}</span></button>
    <button type="button" id="trip-end" class={action} onclick={() => controls.endTrip()}
      ><Icon svg={icons.tripEnd} class="size-20 text-c" /><span>{t("End trip")}</span></button>
  {:else}
    <p id="trip-help" class={[fieldHelp, "mt-0"]}>{t("Mark where you are as you walk, and see the way you came. Your trail stays on this device.")}</p>
    <button type="button" id="trip-start" class={action} onclick={() => controls.mode("trail")}
      ><Icon svg={icons.here} class="size-20 text-c" /><span>{t("Start trip")}</span></button>
  {/if}
  <p id="trip-hint" class={fieldHelp}>{trip
    ? t("Long-press the map, then drag down to mark where you are, or up-right to go back to your last mark.")
    : t("You can also long-press the map and drag down.")}</p>
  <SectionTitle id="trip-history-title" icon={icons.history} label={t("Past trips")} count={String(count)} countId="trip-history-count"
    color="var(--neon-trail)" />
  {#if !hidden}
    <SavedRows {controls} id="trip-list" labelledby="trip-history-title" rows={trips} empty={t("No trips yet.")} color="var(--neon-trail)" />
  {/if}
</div>
