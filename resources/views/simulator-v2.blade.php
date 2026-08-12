@extends('layouts.app')

@section('title', 'Simulator V2')

@section('content')
    <div id="closed-loop-v2-root" style="position: relative; width: 100%; height: 100%; overflow: hidden;">
        <div id="closed-loop-v2-canvas" style="position: relative; z-index: 1; display: block; width: 100%; height: 100%;"></div>
        <div id="closed-loop-v2-ui" style="position: absolute; top: 0; right: 0; z-index: 20; display: flex; flex-direction: column; align-items: flex-end; gap: 8px; width: min(340px, 40vw); pointer-events: none; white-space: pre-wrap; font-family: monospace; padding: 1rem; box-sizing: border-box;"></div>
    </div>
@endsection

@section('scripts')
    @vite(['resources/js/v2/main.js'])
@endsection
