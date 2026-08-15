<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>@yield('title', 'Closed Loop')</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
    <!-- styles moved to resources/css/app.css -->
</head>
<body>
    <header>
        <nav>
            <a href="{{ route('home') }}">Home</a>
            <a href="{{ route('simulator') }}">Simulator</a>
            <a href="{{ route('about') }}">About</a>
        </nav>
    </header>
    <main>
        @yield('content')
    </main>
    @yield('scripts')
</body>
</html>
