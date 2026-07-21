
@extends('layouts.app')

@section('title', 'Simulator')

@section('content')
    <!-- simulator page title and description removed -->

    <div class="simulator-root-wrapper" style="margin-top:1rem">
        <div id="simulator-root"></div>
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
    @vite(['resources/js/simulator.js','resources/js/factory-editor.js'])
@endsection
