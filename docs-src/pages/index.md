---
title: 'Introduction'
emoji: '📖'
description: 'Overview and key benefits of Le Truc'
---

<section-hero>

# 📖 Introduction

<div>
  <p class="lead"><strong>Web development doesn't need to be complicated</strong>. Le Truc lets you create reactive Web Components that enhance your existing HTML.</p>
  {{ toc }}
</div>
</section-hero>

<section class="breakout">

## What is Le Truc?

<module-carousel>
  <div class="slides">
    <div id="slide1" role="tabpanel" aria-current="true" style="background: var(--color-purple-20);">
      <h3>We Can Have Nice Things!</h3>
      <div class="slide-content">
        <ul>
          <li>Embrace the Web Platform</li>
          <li>Use any server-side technology to render HTML</li>
          <li>Have components</li>
          <li>Have reactivity</li>
          <li>Have type safety</li>
          <li>Have optimal performance</li>
          <li>Have fun!</li>
        </ul>
      </div>
    </div>
    <div id="slide2" role="tabpanel" aria-current="false" style="background: var(--color-pink-20);">
      <h3>HTML First.</h3>
      <div class="slide-content">
        <p>Le Truc assumes you start with semantic HTML and want to enhance it with behavior:</p>
        <module-codeblock language="html" copy-success="Copied!" copy-error="Error trying to copy to clipboard!">
         	<p class="meta"><span class="file">hello-world.html</span><span class="language">html</span></p>
<pre class="shiki monokai" style="background-color:#272822;color:#F8F8F2" tabindex="0"><code><span class="line"><span style="color:#F8F8F2">&#x3C;</span><span style="color:#F92672">hello-world</span><span style="color:#F8F8F2">></span></span>
<span class="line"><span style="color:#F8F8F2">  &#x3C;</span><span style="color:#F92672">p</span><span style="color:#F8F8F2">>Hello, &#x3C;</span><span style="color:#F92672">span</span><span style="color:#F8F8F2">>Alice&#x3C;/</span><span style="color:#F92672">span</span><span style="color:#F8F8F2">>!&#x3C;/</span><span style="color:#F92672">p</span><span style="color:#F8F8F2">></span></span>
<span class="line"><span style="color:#F8F8F2">&#x3C;/</span><span style="color:#F92672">hello-world</span><span style="color:#F8F8F2">></span></span></code></pre>
         	<basic-button class="copy">
        		<button type="button" class="secondary small">
         			<span class="label">Copy</span>
        		</button>
         	</basic-button>
        </module-codeblock>
        <p>This means better SEO, faster initial page loads, and progressive enhancement that works even when JavaScript fails.</p>
      </div>
    </div>
    <div id="slide3" role="tabpanel" aria-current="false" style="background: var(--color-orange-20);">
      <h3>Add JavaScript.</h3>
      <div class="slide-content">
        <p>Progressively enhance the user experience by adding interactivity:</p>
        <module-codeblock language="js" copy-success="Copied!" copy-error="Error trying to copy to clipboard!">
          <p class="meta"><span class="file">hello-world.js</span><span class="language">js</span></p>
<pre class="shiki monokai" style="background-color:#272822;color:#F8F8F2" tabindex="0"><code><span class="line"><span style="color:#F92672">import</span><span style="color:#F8F8F2"> { asString, component, setText } </span><span style="color:#F92672">from</span><span style="color:#E6DB74"> '@zeix/le-truc'</span></span>
<span class="line"></span>
<span class="line"><span style="color:#A6E22E">component</span><span style="color:#F8F8F2">(</span><span style="color:#E6DB74">'hello-world'</span><span style="color:#F8F8F2">, { name: </span><span style="color:#A6E22E">asString</span><span style="color:#F8F8F2">() }, (</span><span style="color:#FD971F;font-style:italic">_</span><span style="color:#F8F8F2">, { </span><span style="color:#FD971F;font-style:italic">first</span><span style="color:#F8F8F2"> }) </span><span style="color:#66D9EF;font-style:italic">=></span><span style="color:#F8F8F2"> [</span></span>
<span class="line"><span style="color:#A6E22E">  first</span><span style="color:#F8F8F2">(</span><span style="color:#E6DB74">'span'</span><span style="color:#F8F8F2">, </span><span style="color:#A6E22E">setText</span><span style="color:#F8F8F2">(</span><span style="color:#E6DB74">'name'</span><span style="color:#F8F8F2">)),</span></span>
<span class="line"><span style="color:#F8F8F2">])</span></span>
<span class="line"></span></code></pre>
         	<basic-button class="copy">
            <button type="button" class="secondary small">
              <span class="label">Copy</span>
            </button>
         	</basic-button>
        </module-codeblock>
        <p>Le Truc augments what the platform already provides. It leverages the Web Components standard while adding just enough convenience functions to make reactive UI behaviors easy to implement.</p>
      </div>
    </div>
    <div id="slide4" role="tabpanel" aria-current="false" style="background: var(--color-green-20);">
      <h3>Faster. Because We Do Less.</h3>
      <div class="slide-content">
        <ul>
          <li>Unlike SPA frameworks (React, Vue, Angular, Svelte, Lit, etc.) we <strong>never render</strong> on the client. Instead, the server and browser do this work. Like it's 1995.</li>
          <li>Because we never render on the client, we need no JSON data and no JS templates either. This means less data over the wire and no plumbing DB → JSON → JS → HTML.</li>
          <li>Unlike Hypermedia frameworks (HTMX, Datastar) we don't compensate for the lack of client-side rendering  by a network request if not needed. If possible, we calculate the new state on the client.</li>
          <li>We just add event listeners and set up a signal graph. Invisible work that doesn't cause layout shifts.</li>
          <li>When the user interacts with the UI, we know exactly what to do. We just do fine-grained updates to the DOM. No VDOM, no diffing. Wait for signal 🚦 and go! 🏁</li>
        </ul>
      </div>
    </div>
    <div id="slide5" role="tabpanel" aria-current="false" style="background: var(--color-blue-20);">
      <h3>Minimal Size.</h3>
      <div class="slide-content">
        <p>Because we add less abstractions, we can keep the library small (approximately 5kB gzipped).</p>
        <p>Le Truc is a lightweight library that provides a simple and efficient way to build reactive user interfaces. It is designed to be easy to use and understand, while still providing powerful features for building complex applications.</p>
        <p>HTML ain't broken. CSS ain't broken. JavaScript ain't broken. We just want to split it in chunks (components), detect bugs early (type safety), and have predictable updates without tight coupling (reactivity). That's what we stand for.</p>
      </div>
    </div>

  </div>
  <nav aria-label="Carousel Navigation">
    <button type="button" class="prev" aria-label="Previous">❮</button>
    <button type="button" class="next" aria-label="Next">❯</button>
    <div role="tablist">
      <button
        role="tab"
        aria-selected="true"
        aria-controls="slide1"
        aria-label="Slide 1"
        data-index="0"
        tabindex="0"
      >
        ●
      </button>
      <button
        role="tab"
        aria-current="false"
        aria-controls="slide2"
        aria-label="Slide 2"
        data-index="1"
        tabindex="-1"
      >
        ●
      </button>
      <button
        role="tab"
        aria-current="false"
        aria-controls="slide3"
        aria-label="Slide 3"
        data-index="2"
        tabindex="-1"
      >
        ●
      </button>
      <button
        role="tab"
        aria-current="false"
        aria-controls="slide4"
        aria-label="Slide 4"
        data-index="3"
        tabindex="-1"
      >
        ●
      </button>
      <button
        role="tab"
        aria-current="false"
        aria-controls="slide5"
        aria-label="Slide 5"
        data-index="4"
        tabindex="-1"
      >
        ●
      </button>
    </div>
  </nav>
</module-carousel>

</section>

<section>

## Why Choose Le Truc?

Le Truc shines when you want:

- **Server-rendered content** with client-side enhancements
- **High performance** on all devices (no virtual DOM overhead)
- **Component reusability** without framework lock-in
- **Future-proof** code built on web standards
- **Easy integration** with existing codebases

**Key Benefits:**

- ~5kB gzipped with no dependencies
- TypeScript support with full type safety
- Works with any backend or build setup
- Progressive enhancement friendly

</section>

<section>

## Next Steps

Now that you understand what Le Truc is and its core philosophy, you're ready to:

- Move on to [Getting Started](getting-started.html) to install the library and build your first component

</section>
