<script lang="ts">
  import { t } from "../../i18n";
  import { formatDistance, formatMinutes, pathLength } from "../../viewer/measure";
  import { icons } from "../icons";
  import Actions from "../kit/Actions.svelte";
  import Button from "../kit/Button.svelte";
  import DialogHeader from "../kit/DialogHeader.svelte";
  import HeaderButton from "../kit/HeaderButton.svelte";
  import { clock, type ViewerControls } from "../viewer-controls.svelte";
  import { readingCard } from "./styles";

  // The trail's cards, read beside the map in its red: a finished trip at a
  // glance, and the last mark, whose Edit offers Move and Delete.
  let { controls }: { controls: ViewerControls } = $props();
  const trip = $derived.by(() => {
    controls.tick;
    const shown = controls.viewedTrip();
    if (!shown) return undefined;
    const start = shown.points[0]!, scale = controls.state.metresPerPixel;
    return {
      title: controls.tripName(shown),
      times: `${clock(start.time)} – ${clock(shown.ended)}`,
      stats: [
        ["trip-distance", t("Distance"), scale ? formatDistance(pathLength(shown.points) * scale) : "–"],
        ["trip-duration", t("Time"), formatMinutes(Math.round((shown.ended - start.time) / 60_000))],
        ["trip-points", t("Points"), String(shown.points.length)],
      ],
    };
  });
  const armed = $derived(controls.cardDeleteArmed === "mark-delete");
  const card = [readingCard, "[--c:var(--neon-trail)]"];
</script>

<dialog id="trip-dialog" aria-labelledby="trip-title" data-reading onclose={() => controls.tripClosed()} class={card}>
  <DialogHeader id="trip-title" title={trip?.title ?? ""} icon={icons.trail} class="mb-0! shrink-0" close={{ id: "trip-close", onclick: () => controls.closePlaceDetails() }}>
    {#snippet subtitle()}<p id="trip-times" class="mt-4 mb-0 text-small text-muted">{trip?.times}</p>{/snippet}
  </DialogHeader>
  <!-- A count needs less room than a distance or a time. -->
  <dl class="mt-16 mb-0 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-8">
    {#each trip?.stats ?? [] as [id, label, value] (id)}
      <div class="rounded-md border border-line bg-fill p-12">
        <dt class="text-small text-muted">{label}</dt>
        <dd {id} class="mt-4 mb-0 ml-0 text-heading font-bold whitespace-nowrap text-c tabular-nums">{value}</dd>
      </div>
    {/each}
  </dl>
</dialog>

<dialog id="mark-dialog" aria-labelledby="mark-title" data-reading class={card}>
  <DialogHeader id="mark-title" title={t("Last mark")} icon={icons.trail} class="mb-0! shrink-0" close={{ id: "mark-close", onclick: () => controls.closePlaceDetails() }}>
    {#snippet subtitle()}<p id="mark-time" class="mt-4 mb-0 text-small text-muted">{controls.markTime}</p>{/snippet}
    {#snippet actions()}<HeaderButton id="mark-edit" icon={icons.edit} label={t("Edit mark")} onclick={() => controls.toggleMarkActions()} />{/snippet}
  </DialogHeader>
  <Actions row id="mark-actions" hidden={!controls.markActions} class="motion mt-16! [--enter-from:translateY(12px)]">
    <Button id="mark-delete" variant="quiet-danger" icon={icons.trash} label={armed ? t("Tap again") : t("Delete")} {armed}
      onclick={() => controls.deleteMarkTap()} />
    <Button id="mark-move" variant="quiet" icon={icons.move} label={t("Move")} onclick={() => controls.moveMark()} />
  </Actions>
</dialog>
