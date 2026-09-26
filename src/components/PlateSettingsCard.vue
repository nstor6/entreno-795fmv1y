<script setup lang="ts">
import { formatNumber } from '../domain/format'
import { plateSettings, savePlateSettings } from '../ui/plateSettings'

const BARS = [20, 15, 10]
const PLATES = [25, 20, 15, 10, 5, 2.5, 2, 1.25, 1, 0.5]

function setBar(barKg: number) {
  savePlateSettings({ ...plateSettings.value, barKg })
}
function togglePlate(p: number) {
  const has = plateSettings.value.plates.includes(p)
  const plates = has ? plateSettings.value.plates.filter((x) => x !== p) : [...plateSettings.value.plates, p]
  savePlateSettings({ ...plateSettings.value, plates: plates.sort((a, b) => b - a) })
}
</script>

<template>
  <section class="card stack" aria-labelledby="plates-title">
    <h2 id="plates-title">Barra y discos</h2>
    <p class="muted small">Para «Ver discos» en la sesión. Marca los que hay en tu gimnasio.</p>
    <div class="field-row">
      <span class="label">Barra</span>
      <div class="chips-fill" role="group" aria-label="Peso de la barra">
        <button v-for="b in BARS" :key="b" type="button" class="chip" :aria-pressed="plateSettings.barKg === b" @click="setBar(b)">
          {{ b }} kg
        </button>
      </div>
    </div>
    <div class="field-row">
      <span class="label">Discos</span>
      <div class="plates" role="group" aria-label="Discos disponibles">
        <button
          v-for="p in PLATES"
          :key="p"
          type="button"
          class="chip num-chip"
          :aria-pressed="plateSettings.plates.includes(p)"
          @click="togglePlate(p)"
        >
          {{ formatNumber(p) }}
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.plates {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 4px;
}
</style>
