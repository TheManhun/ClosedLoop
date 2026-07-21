
@extends('layouts.app')

@section('title', 'Simulator')

@section('content')
    <h1>Simulator</h1>
    <p>This page will host the Closed Loop simulator interface.</p>

    <div class="simulator-root-wrapper" style="margin-top:1rem">
        <div class="simulator-toolbar" aria-hidden="false" style="display:none" id="simulator-toolbar">
            <div class="simulator-palette" role="toolbar" aria-label="Building palette">
                <button id="place-process-unit-btn" class="toolbar-button" aria-pressed="false">Process Unit</button>
                <button id="place-sorting-facility-btn" class="toolbar-button" aria-pressed="false">Sorting Facility</button>
            </div>
            <button id="toggle-show-names-btn" class="toolbar-button" aria-pressed="false">Show Names</button>
        </div>
        <div id="simulator-root"></div>
        <!-- Unresolved Outputs panel (HTML overlay, positioned relative to simulator-root-wrapper) -->
        <section class="unresolved-output-panel" aria-label="Unresolved Outputs panel">

            <div class="unresolved-output-body">
                <div class="unresolved-output-chart" id="unresolved-output-chart">
                    <svg width="160" height="160" viewBox="0 0 160 160" role="img" aria-hidden="false"></svg>
                    <div class="unresolved-output-total" id="unresolved-output-total">
                        <strong>100 t</strong>
                        <span>unresolved</span>
                    </div>
                </div>
                <!-- power indicator removed per simplified UI -->

                <div class="unresolved-output-legend" id="unresolved-output-legend" aria-live="polite">
                    <!-- legend rows rendered by simulator.js -->
                </div>
            </div>
        </section>
    </div>
@endsection

@section('scripts')
    @vite('resources/js/simulator.js')
@endsection
