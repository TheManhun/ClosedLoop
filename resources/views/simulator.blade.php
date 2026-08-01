
@extends('layouts.app')

@section('title', 'Simulator')

@section('content')
    <!-- simulator page title and description removed -->

    <div class="simulator-root-wrapper">
        <div id="factory-editor-root" class="factory-editor-root">
            <aside id="toolbox" class="toolbox" aria-label="Toolbox">
                <div class="toolbox-header">
                    <button id="toolbox-toggle" class="toolbox-toggle" aria-expanded="false">☰</button>
                    <div class="toolbox-title">Toolbox</div>
                </div>
                <div class="toolbox-body" id="toolbox-body">
                    <ul id="toolbox-items" class="toolbox-items">
                        <!-- items populated by JS -->
                    </ul>
                </div>
            </aside>
            <main id="viewport" class="viewport" tabindex="0" aria-label="Factory editor viewport">
                <div id="world" class="world">
                    <!-- components placed here -->
                </div>
            </main>
        </div>
        <div class="simulator-main-shell">
            <div id="simulator-status-bar" class="simulator-status-bar" aria-label="System status bar" role="toolbar">
                <button type="button" class="simulator-status-pill is-interactive" data-metric="power">
                    <span class="simulator-status-label">Power</span>
                    <span class="simulator-status-value">—</span>
                </button>
                <button type="button" class="simulator-status-pill is-interactive" data-metric="water">
                    <span class="simulator-status-label">Water</span>
                    <span class="simulator-status-value">—</span>
                </button>
                <button type="button" class="simulator-status-pill is-interactive" data-metric="heat">
                    <span class="simulator-status-label">Heat</span>
                    <span class="simulator-status-value">—</span>
                </button>
                <button type="button" class="simulator-status-pill is-interactive" data-metric="waste">
                    <span class="simulator-status-label">Waste</span>
                    <span class="simulator-status-value">—</span>
                </button>
                <button type="button" class="simulator-status-pill is-interactive" data-metric="build-cost">
                    <span class="simulator-status-label">Build Cost</span>
                    <span class="simulator-status-value">—</span>
                </button>
                <button type="button" class="simulator-status-pill is-interactive" data-metric="income">
                    <span class="simulator-status-label">Annual Income</span>
                    <span class="simulator-status-value">—</span>
                </button>
                <button type="button" class="simulator-status-pill is-interactive" data-metric="grid-flow">
                    <span class="simulator-status-label">Grid Flow</span>
                    <span class="simulator-status-value">—</span>
                </button>
                <button type="button" class="simulator-status-pill is-interactive" data-metric="efficiency">
                    <span class="simulator-status-label">Efficiency</span>
                    <span class="simulator-status-value">—</span>
                </button>
            </div>
            <div id="simulator-root"></div>
            <div id="simulator-popover-root" class="simulator-popover-root">
                <div id="simulator-status-popover" class="simulator-status-popover" role="dialog" aria-label="Power balance details" hidden></div>
            </div>
            <section class="unresolved-output-panel" aria-label="Resource wheel" id="resource-wheel-panel">
                <button type="button" class="unresolved-output-wheel" id="resource-wheel-toggle" aria-expanded="false" aria-controls="resource-wheel-popover" aria-label="Open resource details">
                    <div class="unresolved-output-chart" id="unresolved-output-chart">
                        <svg width="112" height="112" viewBox="0 0 112 112" role="img" aria-hidden="false"></svg>
                        <div class="unresolved-output-total" id="unresolved-output-total">
                            <strong>100%</strong>
                            <span>unresolved</span>
                        </div>
                    </div>
                </button>
                <div class="resource-wheel-popover" id="resource-wheel-popover" role="dialog" aria-label="Resource details" hidden>
                    <div class="resource-wheel-popover-content">
                        <div class="resource-wheel-popover-title">Resources</div>
                        <div class="resource-wheel-popover-tabs" role="tablist" aria-label="Resource lifecycle tabs"></div>
                        <div class="resource-wheel-popover-body" id="unresolved-output-legend" role="tabpanel" aria-live="polite" tabindex="0"></div>
                    </div>
                </div>
            </section>
        </div>
    </div>
@endsection

@section('scripts')
    @vite(['resources/js/simulator.js','resources/js/factory-editor.js'])
@endsection
