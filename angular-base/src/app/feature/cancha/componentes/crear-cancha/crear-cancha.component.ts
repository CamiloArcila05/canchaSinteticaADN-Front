import { Component, OnInit } from '@angular/core';
import {FormControl, FormGroup, Validators} from "@angular/forms";
import {ActivatedRoute, Router} from "@angular/router";
import {Cancha} from "../../shared/model/cancha";
import {CanchaService} from "../../shared/service/cancha.service";
import {NgxSpinnerService} from "ngx-spinner";
import {ToastrService} from "ngx-toastr";

const LONGITUD_MINIMA_PERMITIDA_TEXTO = 3;
const LONGITUD_MAXIMA_PERMITIDA_TEXTO = 150;

@Component({
  selector: 'app-crear-cancha',
  templateUrl: './crear-cancha.component.html',
  styleUrls: ['./crear-cancha.component.scss']
})
export class CrearCanchaComponent implements OnInit {

  canchaForm: FormGroup;

  constructor(private router: Router,
              private canchaService: CanchaService,
              private spinner: NgxSpinnerService,
              private toast: ToastrService,
              private route: ActivatedRoute) { }

  ngOnInit(): void {
    this.cargaFormulario();
  }

  cargaFormulario() {
    this.canchaForm = new FormGroup({
      nombre: new FormControl('', [Validators.required]),
      valorDia: new FormControl('', [Validators.required, Validators.min(1)]),
      valorNoche: new FormControl('', [Validators.required, Validators.min(1)]),
      descripcion: new FormControl('', [Validators.required,
        Validators.minLength(LONGITUD_MINIMA_PERMITIDA_TEXTO),
        Validators.maxLength(LONGITUD_MAXIMA_PERMITIDA_TEXTO)])
    });
  }


  cancelar() {
    this.router.navigate([ '../../cancha' ], { relativeTo: this.route });
  }

  crearCancha() {
    const formValues = this.canchaForm.getRawValue();
    console.log(formValues);
    const cancha = <Cancha> {
      nombre: formValues.nombre,
      descripcion: formValues.descripcion,
      estado: 'ACTIVO',
      valorDia: formValues.valorDia,
      valorNoche: formValues.valorNoche
    };
    this.spinner.show();
    this.canchaService.guardar(cancha)
      .subscribe(
        (res) => {
          console.log(res);
          this.spinner.hide();
          this.toast.success('La cancha: ' + cancha.nombre + ' ha sido creada exitosamente', 'Éxito');
          this.cancelar();
        },
        () => {
          this.spinner.hide();
          this.toast.error('Ocurrio un error inesperado, contacte al administrador del sistema', 'Error');
        }
        );
  }

}
