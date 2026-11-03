/* ==========================================================================
   Jaz Jaz Crochet — interacciones del sitio
   JavaScript sin dependencias. Todo es mejora progresiva: el contenido, la
   navegación y los enlaces funcionan sin este archivo.
   ========================================================================== */
(function () {
  "use strict";

  var defaults = { facebook: "", whatsapp: "", phone: "", email: "", instagram: "" };
  var config = Object.assign({}, defaults, window.JAZ_CONFIG || {});
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var mobileQuery = window.matchMedia("(max-width: 899px)");

  function $(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  function $$(selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  }

  var announcer = $("[data-announcer]");

  function announce(message) {
    if (!announcer) {
      return;
    }
    announcer.textContent = "";
    window.setTimeout(function () {
      announcer.textContent = message;
    }, 80);
  }

  /* ---------------------------------------------------------------------
     Arranque: pantalla de carga inicial
     Se retira al terminar la carga, con un mínimo visible para evitar el
     parpadeo y una salida de seguridad si "load" nunca llega. Con
     movimiento reducido desaparece de inmediato.
     --------------------------------------------------------------------- */
  var pageLoader = $("[data-page-loader]");

  if (pageLoader) {
    var loaderStart = Date.now();
    var loaderMin = Number(pageLoader.getAttribute("data-min-visible")) || 700;
    var loaderSafety = 0;
    var loaderDismissed = false;

    var removeLoader = function () {
      pageLoader.classList.add("is-done");

      if (pageLoader.parentNode) {
        pageLoader.parentNode.removeChild(pageLoader);
      }

      // Aviso para que la cascada inicial arranque con la vista ya libre.
      document.dispatchEvent(new Event("loader:done"));
    };

    var dismissLoader = function () {
      if (loaderDismissed) {
        return;
      }

      loaderDismissed = true;
      window.clearTimeout(loaderSafety);
      pageLoader.classList.add("is-leaving");
      window.setTimeout(removeLoader, reduceMotion.matches ? 0 : 520);
    };

    var finishLoader = function () {
      var elapsed = Date.now() - loaderStart;

      if (reduceMotion.matches) {
        dismissLoader();
        return;
      }

      window.setTimeout(dismissLoader, Math.max(0, loaderMin - elapsed));
    };

    if (document.readyState === "complete") {
      finishLoader();
    } else {
      window.addEventListener("load", finishLoader);
      loaderSafety = window.setTimeout(dismissLoader, 2600);
    }
  }

  /* ---------------------------------------------------------------------
     1. Desplazamiento: sombra del encabezado y botón para volver arriba
     Un único listener pasivo, agrupado con requestAnimationFrame, mantiene
     ambos estados sincronizados.
     --------------------------------------------------------------------- */
  var header = $("[data-header]");
  var backToTop = $("[data-back-to-top]");
  var footer = $(".site-footer");
  var backToTopThreshold = backToTop
    ? Number(backToTop.getAttribute("data-threshold")) || 600
    : 600;
  var scrollTicking = false;

  var updateOnScroll = function () {
    scrollTicking = false;

    if (header) {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    }

    if (backToTop) {
      var footerInView = footer
        ? footer.getBoundingClientRect().top < window.innerHeight - 96
        : false;

      backToTop.classList.toggle(
        "is-visible",
        window.scrollY > backToTopThreshold && !footerInView
      );
    }
  };

  var requestScrollUpdate = function () {
    if (scrollTicking) {
      return;
    }

    scrollTicking = true;

    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(updateOnScroll);
    } else {
      window.setTimeout(updateOnScroll, 16);
    }
  };

  if (header || backToTop) {
    updateOnScroll();
    window.addEventListener("scroll", requestScrollUpdate, { passive: true });
    window.addEventListener("resize", requestScrollUpdate, { passive: true });
  }

  if (backToTop) {
    backToTop.addEventListener("click", function () {
      var main = $("#contenido");

      window.scrollTo({
        top: 0,
        behavior: reduceMotion.matches ? "auto" : "smooth",
      });

      if (main) {
        main.focus({ preventScroll: true });
      }
    });
  }

  /* ---------------------------------------------------------------------
     2. Menú móvil
     --------------------------------------------------------------------- */
  var nav = $("[data-nav]");
  var navToggle = $("[data-nav-toggle]");
  var navLabel = $("[data-nav-label]");

  function setNav(open) {
    if (!nav || !navToggle) {
      return;
    }
    nav.classList.toggle("is-open", open);
    navToggle.setAttribute("aria-expanded", String(open));
    if (navLabel) {
      navLabel.textContent = open ? "Cerrar menú" : "Abrir menú";
    }
  }

  if (nav && navToggle) {
    navToggle.addEventListener("click", function () {
      setNav(navToggle.getAttribute("aria-expanded") !== "true");
    });

    nav.addEventListener("click", function (event) {
      if (event.target.closest("a") && mobileQuery.matches) {
        setNav(false);
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && nav.classList.contains("is-open")) {
        setNav(false);
        navToggle.focus();
      }
    });

    document.addEventListener("click", function (event) {
      if (!mobileQuery.matches || !nav.classList.contains("is-open")) {
        return;
      }
      if (!nav.contains(event.target) && !navToggle.contains(event.target)) {
        setNav(false);
      }
    });

    var onBreakpointChange = function (event) {
      if (!event.matches) {
        setNav(false);
      }
    };

    if (typeof mobileQuery.addEventListener === "function") {
      mobileQuery.addEventListener("change", onBreakpointChange);
    } else if (typeof mobileQuery.addListener === "function") {
      mobileQuery.addListener(onBreakpointChange);
    }
  }

  /* ---------------------------------------------------------------------
     3. Sección activa en la navegación
     --------------------------------------------------------------------- */
  var navLinks = $$(".nav__link[href^='#']");
  var navSections = navLinks
    .map(function (link) {
      return document.getElementById(link.getAttribute("href").slice(1));
    })
    .filter(Boolean);

  if ("IntersectionObserver" in window && navSections.length > 0) {
    var setCurrent = function (id) {
      navLinks.forEach(function (link) {
        if (link.getAttribute("href") === "#" + id) {
          link.setAttribute("aria-current", "true");
        } else {
          link.removeAttribute("aria-current");
        }
      });
    };

    var spy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            setCurrent(entry.target.id);
          }
        });
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
    );

    navSections.forEach(function (section) {
      spy.observe(section);
    });
  }

  /* ---------------------------------------------------------------------
     4. Aparición de bloques al hacer scroll
     Los grupos marcados con data-reveal-stagger reciben un retraso corto
     por pieza para lograr una cascada discreta; el observador es el mismo.
     --------------------------------------------------------------------- */
  var revealItems = $$(".reveal");

  $$("[data-reveal-stagger]").forEach(function (group) {
    $$(".reveal", group).forEach(function (item, index) {
      item.style.setProperty("--reveal-delay", Math.min(index, 4) * 80 + "ms");
    });
  });

  var revealsStarted = false;

  var startReveals = function () {
    if (revealsStarted) {
      return;
    }

    revealsStarted = true;

    if (revealItems.length > 0) {
      if (!("IntersectionObserver" in window) || reduceMotion.matches) {
        revealItems.forEach(function (item) {
          item.classList.add("is-visible");
        });
      } else {
        var revealObserver = new IntersectionObserver(
          function (entries, observer) {
            entries.forEach(function (entry) {
              if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
              }
            });
          },
          { rootMargin: "0px 0px -6% 0px", threshold: 0.06 }
        );

        revealItems.forEach(function (item) {
          revealObserver.observe(item);
        });
      }
    }
  };

  // La cascada inicial espera a que la pantalla de carga libere la vista.
  if (pageLoader && pageLoader.parentNode) {
    document.addEventListener("loader:done", startReveals, { once: true });
    window.setTimeout(startReveals, 3200);
  } else {
    startReveals();
  }

  // main.js llegó hasta aquí: el CSS ya no necesita mostrar todo por su cuenta.
  document.documentElement.classList.add("reveal-ready");

  /* ---------------------------------------------------------------------
     5. "Solicitar información" prepara el formulario de pedido
     --------------------------------------------------------------------- */
  var pieceField = $("#pedido-pieza");
  var ideaField = $("#pedido-idea");
  var nameField = $("#pedido-nombre");

  $$("[data-request]").forEach(function (button) {
    button.addEventListener("click", function () {
      var piece = button.getAttribute("data-request") || "";

      if (pieceField) {
        pieceField.value = piece;
      }

      if (ideaField && ideaField.value.trim() === "") {
        ideaField.value = "Me interesa una pieza como «" + piece + "». ";
      }

      var target = $("#pedidos");
      if (target) {
        target.scrollIntoView({
          behavior: reduceMotion.matches ? "auto" : "smooth",
          block: "start",
        });
      }

      window.setTimeout(
        function () {
          if (ideaField && ideaField.value.trim() !== "") {
            ideaField.focus({ preventScroll: true });
            ideaField.setSelectionRange(ideaField.value.length, ideaField.value.length);
          } else if (nameField) {
            nameField.focus({ preventScroll: true });
          }
        },
        reduceMotion.matches ? 0 : 450
      );

      announce("Pieza «" + piece + "» añadida al formulario de pedido.");
    });
  });

  /* ---------------------------------------------------------------------
     7. Visor de la galería (mejora progresiva sobre enlaces reales)
     --------------------------------------------------------------------- */
  var galleryLinks = $$("[data-gallery-item]");
  var lightbox = $("[data-lightbox]");

  if (lightbox && galleryLinks.length > 0 && typeof lightbox.showModal === "function") {
    var lightboxImage = $("[data-lightbox-img]", lightbox);
    var lightboxCaption = $("[data-lightbox-caption]", lightbox);
    var lightboxCounter = $("[data-lightbox-counter]", lightbox);
    var lightboxClose = $("[data-lightbox-close]", lightbox);
    var currentSlide = 0;
    var lastTrigger = null;

    var renderSlide = function (index) {
      currentSlide = (index + galleryLinks.length) % galleryLinks.length;
      var trigger = galleryLinks[currentSlide];
      lightboxImage.src = trigger.getAttribute("data-full");
      lightboxImage.alt = trigger.getAttribute("data-alt") || "";
      lightboxCaption.textContent = trigger.getAttribute("data-caption") || "";
      lightboxCounter.textContent = currentSlide + 1 + " / " + galleryLinks.length;
    };

    var openLightbox = function (index, trigger) {
      lastTrigger = trigger;
      renderSlide(index);
      document.body.classList.add("is-locked");
      lightbox.showModal();
      lightboxClose.focus();
    };

    galleryLinks.forEach(function (link, index) {
      link.addEventListener("click", function (event) {
        event.preventDefault();
        openLightbox(index, link);
      });
    });

    lightboxClose.addEventListener("click", function () {
      lightbox.close();
    });

    $("[data-lightbox-prev]", lightbox).addEventListener("click", function () {
      renderSlide(currentSlide - 1);
    });

    $("[data-lightbox-next]", lightbox).addEventListener("click", function () {
      renderSlide(currentSlide + 1);
    });

    lightbox.addEventListener("keydown", function (event) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        renderSlide(currentSlide - 1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        renderSlide(currentSlide + 1);
      }
    });

    lightbox.addEventListener("click", function (event) {
      if (event.target === lightbox) {
        lightbox.close();
      }
    });

    lightbox.addEventListener("close", function () {
      document.body.classList.remove("is-locked");
      lightboxImage.removeAttribute("src");
      if (lastTrigger) {
        lastTrigger.focus();
      }
    });
  }

  /* ---------------------------------------------------------------------
     8. Formulario de pedido: validación + resumen para compartir
     --------------------------------------------------------------------- */
  var form = $("#pedido-form");

  if (form) {
    var fieldName = $("#pedido-nombre");
    var fieldPiece = $("#pedido-pieza");
    var fieldIdea = $("#pedido-idea");
    var fieldDate = $("#pedido-fecha");
    var fieldConsent = $("#pedido-acepto");
    var resultPanel = $("[data-result]");
    var resultText = $("#pedido-resumen");
    var resultStatus = $("[data-result-status]");
    var errorBox = $("[data-form-errors]");
    var copyButton = $("[data-copy]");

    var fieldMeta = [
      {
        el: fieldName,
        error: "error-nombre",
        label: "Nombre",
        validate: function (value) {
          return value.trim().length >= 2 ? "" : "Escribe tu nombre (mínimo 2 caracteres).";
        },
      },
      {
        el: fieldPiece,
        error: "error-pieza",
        label: "Tipo de pieza",
        validate: function (value) {
          return value ? "" : "Elige el tipo de pieza que te interesa.";
        },
      },
      {
        el: fieldIdea,
        error: "error-idea",
        label: "Tu idea",
        validate: function (value) {
          return value.trim().length >= 20 ? "" : "Describe tu idea con al menos 20 caracteres.";
        },
      },
    ];

    var setStatus = function (message) {
      if (resultStatus) {
        resultStatus.textContent = message;
      }
    };

    var setFieldError = function (meta, message) {
      var node = document.getElementById(meta.error);
      if (node) {
        node.textContent = message;
      }
      if (meta.el) {
        if (message) {
          meta.el.setAttribute("aria-invalid", "true");
        } else {
          meta.el.removeAttribute("aria-invalid");
        }
      }
    };

    var validateField = function (meta) {
      var message = meta.el ? meta.validate(meta.el.value) : "";
      setFieldError(meta, message);
      return message === "";
    };

    fieldMeta.forEach(function (meta) {
      if (!meta.el) {
        return;
      }
      meta.el.addEventListener("blur", function () {
        validateField(meta);
      });
      meta.el.addEventListener("input", function () {
        if (meta.el.getAttribute("aria-invalid") === "true") {
          validateField(meta);
        }
      });
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var invalid = [];

      fieldMeta.forEach(function (meta) {
        if (!validateField(meta)) {
          invalid.push(meta);
        }
      });

      var consentError = document.getElementById("error-acepto");
      if (fieldConsent && !fieldConsent.checked) {
        if (consentError) {
          consentError.textContent = "Marca la casilla para continuar.";
        }
        fieldConsent.setAttribute("aria-invalid", "true");
        invalid.push({ el: fieldConsent, label: "Confirmación" });
      } else if (fieldConsent) {
        fieldConsent.removeAttribute("aria-invalid");
        if (consentError) {
          consentError.textContent = "";
        }
      }

      if (errorBox) {
        errorBox.innerHTML = "";
        errorBox.hidden = invalid.length === 0;
      }

      if (invalid.length > 0) {
        if (errorBox) {
          var errorTitle = document.createElement("p");
          errorTitle.textContent =
            "Revisa " + (invalid.length === 1 ? "este campo" : "estos campos") + ":";
          var errorList = document.createElement("ul");

          invalid.forEach(function (item) {
            var entry = document.createElement("li");
            var jump = document.createElement("a");
            jump.href = item.el && item.el.id ? "#" + item.el.id : "#pedido-form";
            jump.textContent = item.label;
            jump.addEventListener("click", function (clickEvent) {
              clickEvent.preventDefault();
              if (item.el) {
                item.el.focus();
              }
            });
            entry.appendChild(jump);
            errorList.appendChild(entry);
          });

          errorBox.appendChild(errorTitle);
          errorBox.appendChild(errorList);
        }

        if (invalid[0] && invalid[0].el) {
          invalid[0].el.focus();
        }
        announce("El formulario tiene campos por revisar.");
        return;
      }

      var pieceLabel = fieldPiece.value.trim();
      var summaryLines = [
        "Solicitud de pedido — Jaz Jaz Crochet",
        "",
        "Nombre: " + fieldName.value.trim(),
        "Tipo de pieza: " + pieceLabel,
        "Idea: " + fieldIdea.value.trim(),
      ];

      if (fieldDate && fieldDate.value) {
        var parsedDate = new Date(fieldDate.value + "T00:00:00");
        if (!Number.isNaN(parsedDate.getTime())) {
          summaryLines.push(
            "Fecha ideal: " +
              parsedDate.toLocaleDateString("es", { day: "2-digit", month: "long", year: "numeric" })
          );
        }
      }

      summaryLines.push(
        "",
        "Resumen generado en el sitio web. No se envió automáticamente: se comparte por el canal de contacto que elijas."
      );

      if (resultText) {
        resultText.value = summaryLines.join("\n");
      }

      if (resultPanel) {
        resultPanel.hidden = false;
        resultPanel.scrollIntoView({
          behavior: reduceMotion.matches ? "auto" : "smooth",
          block: "nearest",
        });
      }

      setStatus("Resumen listo. Cópialo y envíalo por Facebook.");
      announce("Resumen del pedido generado. Cópialo y envíalo por Facebook.");

      if (copyButton) {
        copyButton.focus({ preventScroll: true });
      }
    });

    var copySummary = function () {
      if (!resultText) {
        return;
      }

      var copied = function () {
        setStatus("Resumen copiado. Pégalo en el chat de Facebook.");
        announce("Resumen copiado al portapapeles.");
      };

      var fallback = function () {
        resultText.focus();
        resultText.select();
        var ok = false;
        try {
          ok = document.execCommand("copy");
        } catch (error) {
          ok = false;
        }
        if (ok) {
          copied();
        } else {
          setStatus("No pudimos copiar automáticamente. Selecciona el texto y cópialo a mano.");
        }
      };

      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(resultText.value).then(copied, fallback);
      } else {
        fallback();
      }
    };

    if (copyButton) {
      copyButton.addEventListener("click", copySummary);
    }

    var downloadButton = $("[data-download]");
    if (downloadButton) {
      downloadButton.addEventListener("click", function () {
        if (!resultText || !resultText.value) {
          return;
        }
        var blob = new Blob([resultText.value], { type: "text/plain;charset=utf-8" });
        var url = URL.createObjectURL(blob);
        var link = document.createElement("a");
        link.href = url;
        link.download = "pedido-jaz-jaz-crochet.txt";
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(function () {
          URL.revokeObjectURL(url);
        }, 1500);
        setStatus("Resumen descargado. Adjúntalo o pégalo en el chat de Facebook.");
      });
    }
  }

  /* ---------------------------------------------------------------------
     9. Canales de contacto configurables (assets/js/config.js)
     Ningún canal sin dato real se muestra ni genera enlaces.
     --------------------------------------------------------------------- */
  var onlyDigits = function (value) {
    return String(value || "").replace(/\D/g, "");
  };

  var externalLink = function (link) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  };

  var channelNodes = function (name) {
    return $$("[data-channel='" + name + "']");
  };

  var revealChannel = function (name, href, labelText) {
    channelNodes(name).forEach(function (node) {
      var link = node.matches("a") ? node : node.querySelector("a");
      if (!link) {
        return;
      }
      link.href = href;
      var label = link.querySelector("[data-channel-value]");
      if (label && labelText) {
        label.textContent = labelText;
      }
      node.hidden = false;
    });
  };

  if (config.facebook) {
    $$("[data-facebook-link]").forEach(function (link) {
      link.href = config.facebook;
      externalLink(link);
    });
    revealChannel("facebook", config.facebook);
  } else {
    channelNodes("facebook").forEach(function (node) {
      node.hidden = true;
    });
  }

  var whatsappNumber = onlyDigits(config.whatsapp);
  if (whatsappNumber.length >= 8) {
    var whatsappText = "Hola, quiero consultar por una pieza de crochet de Jaz Jaz Crochet.";
    revealChannel(
      "whatsapp",
      "https://wa.me/" + whatsappNumber + "?text=" + encodeURIComponent(whatsappText),
      config.phone || "+" + whatsappNumber
    );
    channelNodes("whatsapp").forEach(function (node) {
      var link = node.matches("a") ? node : node.querySelector("a");
      if (link) {
        externalLink(link);
      }
    });
  }

  if (config.phone) {
    revealChannel("phone", "tel:" + String(config.phone).replace(/[^\d+]/g, ""), config.phone);
  }

  if (config.email) {
    revealChannel("email", "mailto:" + config.email, config.email);
  }

  if (config.instagram) {
    revealChannel("instagram", config.instagram);
    channelNodes("instagram").forEach(function (node) {
      var link = node.matches("a") ? node : node.querySelector("a");
      if (link) {
        externalLink(link);
      }
    });
  }

  /* ---------------------------------------------------------------------
     10. Año actual en el pie de página
     --------------------------------------------------------------------- */
  $$("[data-year]").forEach(function (node) {
    node.textContent = String(new Date().getFullYear());
  });
})();






